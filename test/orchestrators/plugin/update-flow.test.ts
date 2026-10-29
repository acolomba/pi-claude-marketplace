import assert from "node:assert/strict";
import { chmodSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import {
  githubSource,
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { createInstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { AgentTargetOccupiedError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import {
  BridgeStagingError,
  McpServerCollisionError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import {
  CleanupContextError,
  DependencyDeclarationsUnreadableError,
  InvalidGitHubBaseUrlError,
  InvalidMarketplaceManifestError,
  MarketplaceNotFoundError,
  PluginUpdateConcurrencyError,
  PluginUpdatePhase3Error,
  StateLockCompromisedError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded, runWithSoftDeps } from "../../shared/notification-run-seeds.ts";
import { whileStateLockHeld } from "../state-lock.ts";

import { materializeCommitCopyWith } from "./mirror-checkout.ts";

import type { ParsedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { UpdatePluginsFn } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import type {
  UpdateCloneCacheSeam,
  UpdatePluginsOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { PluginUpdateFn } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  NotificationContext,
  SoftDepStatus,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { GitHttpRequest, GitHttpResponse } from "isomorphic-git/http/node";

function createUpdateOperations() {
  return createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

function updatePlugins(options: UpdatePluginsOptions): Promise<void> {
  return createUpdateOperations().updatePlugins(options);
}

const updateSinglePlugin: PluginUpdateFn = (plugin, marketplace, scope) =>
  createUpdateOperations().beginPluginUpdateRun()(plugin, marketplace, scope);

const UPDATE_REMOTE_URLS = [
  "https://github.com/anthropics/test.git",
  "https://github.com/org/repo.git",
  "https://github.com/test/repo.git",
  "https://example.com/org/repo",
  "https://example.com/org/repo.git",
  "https://example.com/org/mono",
  "https://example.com/org/monorepo",
] as const;

const DEVICE_CODE = {
  device_code: "MOCK_DEVICE_CODE",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 0,
} as const;

function fixtureMarketplaceDir(
  name: "valid-marketplace" | "invalid-manifest" | "empty-marketplace",
): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "marketplace",
    "_fixtures",
    name,
  );
}

async function seedGithubMarketplaceForSync(cwd: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir("official");
  await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      official: {
        name: "official",
        scope: "project",
        source: githubSource("https://github.com/test/repo#main"),
        addedFromCwd: cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: { hello: makePluginRecord("1.0.0") },
      },
    },
  });
}

function createGitOps(
  options: {
    readonly fixtureSourceDir?: string;
    readonly head?: string;
    readonly remoteHead?: string;
    readonly localRefs?: Readonly<Record<string, string>>;
    readonly remoteRefs?: Readonly<Record<string, string>>;
    readonly remoteResolveMap?: Readonly<Record<string, string>>;
    readonly cloneThrows?: Error;
    readonly fetchThrows?: Error;
    readonly checkoutThrows?: Error;
    readonly resolveRemoteRefThrows?: Error;
  } = {},
): {
  readonly gitOps: ReturnType<typeof createGitOpsFake>["gitOps"];
  readonly state: {
    readonly cloneCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"];
    readonly fetchCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["fetch"];
    readonly forceUpdateRefCalls: ReturnType<
      typeof createGitOpsFake
    >["state"]["calls"]["forceUpdateRef"];
    readonly checkoutCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["checkout"];
    readonly resolveRefCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["resolveRef"];
    readonly resolveRemoteRefCalls: ReturnType<
      typeof createGitOpsFake
    >["state"]["calls"]["resolveRemoteRef"];
  };
} {
  const remoteRefs = {
    ...Object.fromEntries(
      Object.entries(options.remoteRefs ?? {}).map(([ref, oid]) => [ref.split("/").at(-1)!, oid]),
    ),
    ...(options.remoteResolveMap ?? {}),
  };
  const fake = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: UPDATE_REMOTE_URLS,
    ...(options.fixtureSourceDir !== undefined && {
      cloneFixture: { boundary: "local" as const, sourceDir: options.fixtureSourceDir },
    }),
    ...((options.head ?? options.remoteHead) !== undefined && {
      initialOid: options.head ?? options.remoteHead!,
      remoteHead: options.remoteHead ?? options.head!,
    }),
    ...(options.localRefs !== undefined && { localRefs: options.localRefs }),
    ...(Object.keys(remoteRefs).length > 0 && { remoteRefs }),
    ...(options.cloneThrows !== undefined && { cloneError: options.cloneThrows }),
    ...(options.fetchThrows !== undefined && { fetchError: options.fetchThrows }),
    ...(options.checkoutThrows !== undefined && { checkoutError: options.checkoutThrows }),
    ...(options.resolveRemoteRefThrows !== undefined && {
      resolveRemoteRefError: options.resolveRemoteRefThrows,
    }),
  });
  const gitOps: typeof fake.gitOps = {
    ...fake.gitOps,
    async clone(cloneOptions) {
      await fake.gitOps.clone(cloneOptions);
    },
    async resolveRef(resolveOptions) {
      if (resolveOptions.ref === "refs/remotes/origin/HEAD") {
        const remoteMain = fake.state.localRefs["refs/remotes/origin/main"];
        if (remoteMain !== undefined) {
          return remoteMain;
        }
      }

      return fake.gitOps.resolveRef(resolveOptions);
    },
    async resolveRemoteRef(resolveOptions) {
      return fake.gitOps.resolveRemoteRef(resolveOptions);
    },
  };
  return {
    gitOps,
    state: {
      cloneCalls: fake.state.calls.clone,
      fetchCalls: fake.state.calls.fetch,
      forceUpdateRefCalls: fake.state.calls.forceUpdateRef,
      checkoutCalls: fake.state.calls.checkout,
      resolveRefCalls: fake.state.calls.resolveRef,
      resolveRemoteRefCalls: fake.state.calls.resolveRemoteRef,
    },
  };
}

// PUP-1..9 + AS-3 (3-phase) + AS-7 + WR-04 + NFR-2 + NFR-3 coverage:
//
//   PUP-1: three forms (bare / @mp / pl@mp); empty-target silent success.
//   PUP-2: syncCloneOnce memoization (gitOps call counts ASSERT once per mp).
//   PUP-3: unchanged (version equality; NO I/O on bridges).
//   PUP-4: skipped (no longer installable).
//   PUP-5: skipped (entry missing from refreshed manifest).
//   PUP-6: happy 3-phase + phase-3 failure recovery hint (RECOVERY_PLUGIN_REINSTALL_PREFIX).
//   PUP-7: phase-3 abort cleans staging, no mask of original error.
//   PUP-8: reload hint when >=1 plugin updated; suppressed when 0 updated.
//   PUP-9: cascade vs direct routing (updateSinglePlugin never throws;
//          updatePlugins surfaces phase-2-or-earlier throws via V2
//          notify() with a synthetic PluginFailedMessage carrying cause).
//
// Byte-exact assertions match the catalog forms at
// docs/output-catalog.md:489-568 (plugin update). The `[<scope>]`
// plugin-row bracket is suppressed by orphan-fold (plugin.scope
// === mp.scope -> renderScopeBracket returns ""). Empty-targets renders
// `(no marketplaces)` via notify({ marketplaces: [] }), mirroring
// orchestrators/marketplace/update.ts. Direct-path
// failures (enumerate / syncClone / runThreePhaseUpdate / phase-3
// aggregate) surface as synthetic PluginFailedMessage rows with cause
// threaded for the 4-space cause-chain trailer per D-16-08.

interface NotifyRecord {
  message: string;
  severity?: string;
}

/**
 * A case-owned temporary directory, by its resolved path, so it matches the
 * paths that `process.cwd()` and the filesystem report where the temp
 * directory is a symlink (macOS: /var -> /private/var).
 */
async function createCaseDir(prefix: string): Promise<string> {
  return realpath(await mkdtemp(path.join(tmpdir(), prefix)));
}

function makeCtx(softDeps?: Partial<SoftDepStatus>): {
  ctx: NotificationContext;
  run: NotificationRun;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  };
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
    ...softDeps,
  });
  return { ctx, run, notifications };
}

/**
 * Runs `effect` once, right after the first state save whose saved state
 * satisfies `predicate`, and binds update operations to that observed state
 * I/O. The effect lands inside the save's lock, before the update's next step,
 * so it needs no file watcher and no timing.
 */
function observeStateTransition(
  predicate: (state: ExtensionState) => boolean,
  effect: (state: ExtensionState) => void,
): {
  readonly fired: () => boolean;
  readonly updatePlugins: UpdatePluginsFn;
  readonly updateSinglePlugin: PluginUpdateFn;
} {
  let didFire = false;
  const operations = createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
    {
      saveState: async (extensionRoot, state) => {
        await saveState(extensionRoot, state);
        if (!didFire && predicate(state)) {
          didFire = true;
          effect(structuredClone(state));
        }
      },
    },
  );
  return {
    fired: () => didFire,
    updatePlugins: operations.updatePlugins,
    updateSinglePlugin: operations.beginPluginUpdateRun(),
  };
}

/**
 * Plays a concurrent writer that edits the state after preflight: the first
 * locked load (the intent-mark guard) applies `mutate`, persists the result,
 * and hands the mutated state to the update.
 */
function mutateAtFirstLockedLoad(mutate: (state: ExtensionState) => void): {
  readonly fired: () => boolean;
  readonly updateSinglePlugin: PluginUpdateFn;
} {
  let didFire = false;
  const operations = createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
    {
      loadState: async (extensionRoot) => {
        const state = await loadState(extensionRoot);
        if (!didFire) {
          didFire = true;
          mutate(state);
          await saveState(extensionRoot, state);
        }

        return state;
      },
    },
  );
  return { fired: () => didFire, updateSinglePlugin: operations.beginPluginUpdateRun() };
}

function makeCredentialOps(): ReturnType<typeof createCredentialOpsFake>["credentialOps"] {
  return createCredentialOpsFake({ boundary: "memory" }).credentialOps;
}

function makeDeviceFlowHttp(): ReturnType<typeof createDeviceFlowFake>["http"] {
  return createDeviceFlowFake({
    boundary: "memory",
    network: "disabled",
    deviceCode: DEVICE_CODE,
  }).http;
}

function capturingUpdateSeam(gitOps: GitOps): {
  readonly seam: UpdateCloneCacheSeam;
  readonly captured: {
    pinAuth: GitAuthBundle | undefined;
    cloneAuth: GitAuthBundle | undefined;
  };
} {
  const captured: {
    pinAuth: GitAuthBundle | undefined;
    cloneAuth: GitAuthBundle | undefined;
  } = {
    pinAuth: undefined,
    cloneAuth: undefined,
  };
  const seam: UpdateCloneCacheSeam = {
    resolvePluginPin: (args) => {
      captured.pinAuth = args.auth;
      return resolvePluginPin({ ...args, gitOps });
    },
    materializePluginClone: (args) => {
      captured.cloneAuth = args.resolveAuth();
      return materializePluginClone({ ...args, gitOps });
    },
    materializeOrRefreshPluginMirror: (args) => {
      captured.cloneAuth = args.auth;
      return materializeOrRefreshPluginMirror({ ...args, gitOps });
    },
    materializePluginCommitCopy: (args) => materializeCommitCopyWith(gitOps, args),
  };
  return { seam, captured };
}

export async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  return withHermeticEnvironment("update-", fn);
}

async function seedGitUpdateMarketplace(opts: {
  readonly cwd: string;
  readonly cloneUrl: string;
  readonly entrySource: unknown;
  readonly recordedSha: string;
  readonly versionTag: string;
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
            version: opts.versionTag,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            enabled: true,
            provenance: "explicit",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: ["seeded-skill"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            resolvedSource: oldCloneRoot,
            resolvedSha: opts.recordedSha,
          },
        },
      },
    },
  });
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(
  version: string,
  overrides: Partial<PluginRecord["resources"]> & { enabled?: boolean } = {},
): PluginRecord {
  const { enabled = true, ...resources } = overrides;
  return {
    version,
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    // Default to a populated skill so the update flow exercises the
    // enabled-update path, not the disabled-record short-circuit (ENBL-02).
    resources: {
      skills: resources.skills ?? ["seeded-skill"],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
      hooks: resources.hooks ?? [],
      workflows: [],
    },
    enabled,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * D-UPD test helper: seeded record with `enabled: false` -- the ENBL-02
 * disabled marker that `isRecordedButDisabled` reads. The `update`
 * orchestrator must refresh the version/source pin but keep the record
 * disabled (artifacts re-materialize on the next `enable`).
 */
function makeDisabledPluginRecord(version: string): PluginRecord {
  return makePluginRecord(version, {
    enabled: false,
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
    hooks: [],
  });
}

/**
 * ENBL-09 test helper: the disabled PARTIAL shape. Disabled-ness (`enabled`)
 * and availability (`compatibility.installable`) are orthogonal axes, so this
 * record carries `enabled: false` beside a FALSE availability discriminant and
 * a non-empty unsupported list -- the two fields that must stay in agreement
 * after `update` refreshes the block.
 */
function makeDisabledPartialPluginRecord(version: string): PluginRecord {
  return {
    ...makeDisabledPluginRecord(version),
    compatibility: {
      installable: false,
      notes: [],
      supported: ["skills"],
      unsupported: ["themes"],
    },
  };
}

export interface SeededPathMp {
  marketplaceRoot: string;
  manifestPath: string;
}

export interface SeededUpdateAgent {
  readonly directory?: string;
  readonly sourceName: string;
  readonly frontmatterName?: string;
  readonly description?: string;
  readonly body?: string;
}

async function seedUpdateAgents(
  pluginRoot: string,
  agents: readonly SeededUpdateAgent[] = [],
): Promise<void> {
  for (const agent of agents) {
    const agentDir = path.join(pluginRoot, agent.directory ?? "agents");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      path.join(agentDir, `${agent.sourceName}.md`),
      "---\n" +
        `name: ${agent.frontmatterName ?? agent.sourceName}\n` +
        `description: ${agent.description ?? `${agent.sourceName} agent`}\n` +
        "tools: Read,Grep\n" +
        "---\n\n" +
        (agent.body ?? `${agent.sourceName} body.\n`),
    );
  }
}

/**
 * Build a marketplace tree on disk and seed a path-source state record.
 * The plugins map carries entries we control; tests then mutate the
 * on-disk manifest between calls to simulate version bumps / removals.
 */
export async function seedPathMarketplace(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  /** Map of plugin name -> { version, hasSkill?, hasCommand?, hasAgent?, hasMcp?, hooksJson? } */
  manifestPlugins: Record<
    string,
    {
      version: string;
      rawSourceOverride?: unknown;
      hasSkill?: boolean;
      hasCommand?: boolean;
      hasAgent?: boolean;
      /** Declared agent directories; the conventional agents/ directory remains additive. */
      agentDirectories?: readonly string[];
      /** Agent files to distribute across declared and conventional directories. */
      agents?: readonly SeededUpdateAgent[];
      hasMcp?: boolean;
      /** WR-03: seed `<pluginRoot>/hooks/hooks.json` with this payload. */
      hooksJson?: object;
      /**
       * DFEN-01: stamp `defaultEnabled` on the MARKETPLACE entry -- the side
       * that WINS the DFEN-02 precedence rule. Stamping the plugin's own
       * `plugin.json` instead would resolve through the fallback, so a fixture
       * aimed at the wrong side can pass for the wrong reason.
       * Absent -> the entry is written exactly as it is without this knob.
       */
      entryDefaultEnabled?: boolean;
      /**
       * Write the plugin's own `.claude-plugin/plugin.json` WITHOUT a
       * `version` field. That field is tier 1 of the SNM-34 ladder and
       * outranks `entry.version`, so omitting it hands the decision to tier 2
       * and makes a manifest-side version bump observable on the record.
       * Absent or false (default) -> the legacy seeded shape, which mirrors
       * `version` into plugin.json.
       */
      omitPluginJsonVersion?: boolean;
    }
  >;
  /** Map of plugin name -> existing state record version. Absent -> no prior install. */
  installedVersions?: Record<string, string>;
  /** Scope seeded for owner-bound direct/cascade lifecycle cases. */
  scope?: "project" | "user";
}): Promise<SeededPathMp> {
  const { cwd, marketplaceRoot, marketplaceName, manifestPlugins } = opts;
  const scope = opts.scope ?? "project";

  await mkdir(marketplaceRoot, { recursive: true });
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });

  for (const [pluginName, spec] of Object.entries(manifestPlugins)) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
    await mkdir(pluginRoot, { recursive: true });
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: pluginName,
        ...(spec.omitPluginJsonVersion !== true && { version: spec.version }),
      }),
    );

    if (spec.hasSkill !== false) {
      const skillDir = path.join(pluginRoot, "skills", "tool");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: tool\n---\n\nBody for ${pluginName} ${spec.version}.\n`,
      );
    }

    if (spec.hasCommand === true) {
      const cmdDir = path.join(pluginRoot, "commands");
      await mkdir(cmdDir, { recursive: true });
      await writeFile(path.join(cmdDir, "deploy.md"), `# deploy for ${pluginName}\n\nBody.\n`);
    }

    if (spec.hasAgent === true) {
      const agentDir = path.join(pluginRoot, "agents");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "bot.md"),
        `---\nname: bot\ntools: Read,Grep\n---\n\nBody.\n`,
      );
    }

    await seedUpdateAgents(pluginRoot, spec.agents);

    if (spec.hasMcp === true) {
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { server1: { command: "node", args: ["s.js"] } } }),
      );
    }

    // WR-03: seed hooks payload so the resolver advertises hooksConfigPath
    // and the update ledger exercises the cache+rebuild path.
    if (spec.hooksJson !== undefined) {
      const hooksDir = path.join(pluginRoot, "hooks");
      await mkdir(hooksDir, { recursive: true });
      await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(spec.hooksJson));
    }
  }

  const entries = Object.entries(manifestPlugins).map(([name, spec]) => ({
    name,
    source: spec.rawSourceOverride ?? `./plugins/${name}`,
    version: spec.version,
    ...(spec.agentDirectories !== undefined && { agents: [...spec.agentDirectories] }),
    ...(spec.entryDefaultEnabled !== undefined && { defaultEnabled: spec.entryDefaultEnabled }),
  }));
  const manifest = { name: marketplaceName, plugins: entries };
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest));

  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const installedPlugins: Record<string, PluginRecord> = {};
  for (const [pluginName, installedVersion] of Object.entries(opts.installedVersions ?? {})) {
    installedPlugins[pluginName] = {
      ...makePluginRecord(installedVersion),
      resolvedSource: path.join(marketplaceRoot, "plugins", pluginName),
    };
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [marketplaceName]: {
        name: marketplaceName,
        scope,
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: installedPlugins,
      },
    },
  });

  return { marketplaceRoot, manifestPath };
}

async function seedAgentSkillPreload(marketplaceRoot: string): Promise<void> {
  await writeFile(
    path.join(marketplaceRoot, "plugins", "hello", "agents", "bot.md"),
    "---\n" +
      "name: bot\n" +
      "description: Uses the installed skill\n" +
      "tools: Read,Skill\n" +
      "skills: tool\n" +
      "---\n\n" +
      "Use hello:tool.\n",
  );
}

/**
 * Rewrite the on-disk manifest to a new shape. Used to simulate a
 * marketplace update where entry.version changed or entries were removed.
 */
async function rewriteManifest(
  manifestPath: string,
  name: string,
  plugins: Record<
    string,
    {
      version?: string;
      rawSourceOverride?: unknown;
      /**
       * DFEN-01: same knob as the seeder's, on the same winning side of the
       * DFEN-02 precedence, so a rewrite can MOVE the declaration.
       */
      entryDefaultEnabled?: boolean;
    }
  >,
): Promise<void> {
  const entries = Object.entries(plugins).map(([n, spec]) => ({
    name: n,
    source: spec.rawSourceOverride ?? `./plugins/${n}`,
    ...(spec.version !== undefined && { version: spec.version }),
    ...(spec.entryDefaultEnabled !== undefined && { defaultEnabled: spec.entryDefaultEnabled }),
  }));
  await writeFile(manifestPath, JSON.stringify({ name, plugins: entries }));
}

// ─── PUP-1: empty target ───────────────────────────────────────────────────────

test("PUP-1: a bare update against empty state reports its no-op headline", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup1-empty-");
    try {
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({ ctx, run, scope: "project", cwd, target: { kind: "all" } });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(notifications[0]?.message, "Plugin update: nothing to update");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-3: unchanged path -- string version equality, no I/O ──────────────────

test("PUP-3: version equality -> outcome.partition='unchanged'; no bridge state mutation", async (testContext) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup3-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Capture state mtime before; assert state.json is NOT rewritten.
      const stateJsonPath = path.join(locations.extensionRoot, "state.json");
      const before = await readFile(stateJsonPath, "utf8");
      const completionCache = createCompletionCache();
      const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );

      const { ctx, run, notifications } = makeCtx();
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const after = await readFile(stateJsonPath, "utf8");
      assert.equal(before, after, "state.json must NOT be rewritten on unchanged path");

      // V2 byte form mirrors catalog
      // `all-up-to-date-noop` (docs/output-catalog.md). The
      // `unchanged` partition maps to a `(skipped) {up-to-date}` row.
      // The benign `up-to-date` reason (in BENIGN_REASONS) routes
      // severity to info per UXG-02 / D-28-06. Plugin-row `[<scope>]`
      // bracket is suppressed by orphan-fold (plugin.scope ===
      // mp.scope -> renderScopeBracket returns ""). No reload-hint when
      // no plugin row is in the state-changing variant set per D-16-12.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const body = notifications[0]?.message ?? "";
      assert.equal(body, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");
      assert.equal(body.includes("Unchanged:"), false);
      assert.equal(
        body.includes("/reload to pick up changes"),
        false,
        "no reload hint when 0 updated",
      );
      assert.strictEqual(drop.mock.callCount(), 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-4: skipped, no longer installable ─────────────────────────────────────

test("PUP-4: source overridden to unsupported npm -> outcome.partition='skipped' with 'is no longer installable'", async (testContext) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-pup4-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // MM-3 / PR-2: npm-source plugin entry is not installable.
        manifestPlugins: {
          hello: {
            version: "1.1.0",
            hasSkill: true,
            rawSourceOverride: { source: "npm", package: "some-pkg" },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      const completionCache = createCompletionCache();
      const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // V2 byte form. `(skipped) {no longer
      // installable}` row with the optional `v<fromVersion>` token from
      // the installed record (PUP-4 carries `fromVersion: "1.0.0"`).
      // Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      // Severity routes via warning per D-16-11.
      assert.equal(
        body,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {no longer installable}",
      );
      assert.equal(notifications[0]?.severity, "warning");
      assert.strictEqual(drop.mock.callCount(), 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-5: skipped, entry not in refreshed manifest ───────────────────────────

test("PUP-5: refreshed manifest no longer lists entry -> outcome.partition='skipped' with 'not in manifest'", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup5-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Simulate the marketplace dropping the entry after install.
      await rewriteManifest(seeded.manifestPath, "mp", {});

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // V2 byte form. `(skipped) {not in manifest}`
      // row with the optional `v<fromVersion>` token from the installed
      // record. Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      assert.equal(
        body,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-5: an accepted empty recorded version is omitted from the failed row", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup5-empty-version-");
    try {
      // arrange
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "" },
      });
      await rewriteManifest(seeded.manifestPath, "mp", {});
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(
        notifications[0]?.message,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {not in manifest}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── LIFE-05 / D-98-13: the manifest-absent skip on all three enumeration paths ─
//
// `UpdatePluginsTarget` has three shapes -- targeted (`plugin` + `marketplace`),
// marketplace-bulk (`marketplace`), and global-bulk (`all`) -- and all three
// converge on the SAME `preflightUpdate` arm that returns `partition: "skipped"`
// with `reasons: ["not in manifest"]` when the refreshed manifest no longer
// lists the installed entry. PUP-5 above pins the targeted shape; the two cases
// below pin the remaining two, byte for byte, so a future change to
// `enumerateTargets` cannot silently drop the skip on a bulk path.
//
// Both bulk shapes render the SAME row bytes as the targeted shape: the
// `[project]` bracket rides the marketplace header, and the plugin-row bracket
// is suppressed by orphan-fold (plugin.scope === mp.scope). The bulk bodies
// carry ONE extra line the targeted body does not: the OUT-03 / D-04 tally,
// which renders on `cardinality: "plural"` operations only. The tally is an
// orthogonal contract -- the skip row itself is unchanged across all three
// paths, which is what these cases pin.

/**
 * The byte form the targeted case (PUP-5) pins, reused verbatim by both bulk
 * cases. Copied rather than referenced so PUP-5 stays an independent pin: two
 * assertions of the same literal catch a drift that one shared constant would
 * hide on both sides at once.
 */
const MANIFEST_ABSENT_UPDATE_BODY =
  "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}";

/** The bulk-form body: the targeted row bytes plus the plural-cardinality tally. */
const MANIFEST_ABSENT_BULK_BODY = `${MANIFEST_ABSENT_UPDATE_BODY}\n\nPlugin update: 1 warning`;

test("LIFE-05: marketplace-bulk target renders `(skipped) {not in manifest}`, and a repeated update is byte-identical", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-life05-mp-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // The marketplace drops the entry after install.
      await rewriteManifest(seeded.manifestPath, "mp", {});

      const firstRun = makeCtx();
      await updatePlugins({
        ctx: firstRun.ctx,
        run: firstRun.run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(firstRun.notifications.length, 1);
      assert.equal(firstRun.notifications[0]?.message, MANIFEST_ABSENT_BULK_BODY);
      assert.equal(firstRun.notifications[0]?.severity, "warning");

      // NFR-3: the skip arm is idempotent. Re-running the same update over the
      // same state must render the same bytes -- a drifting second run would
      // mean the first run mutated something the row reads.
      const secondRun = makeCtx();
      await updatePlugins({
        ctx: secondRun.ctx,
        run: secondRun.run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(secondRun.notifications.length, 1);
      assert.equal(secondRun.notifications[0]?.message, firstRun.notifications[0]?.message);
      assert.equal(secondRun.notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-05: global-bulk target renders `(skipped) {not in manifest}` and writes NO state", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-life05-all-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await rewriteManifest(seeded.manifestPath, "mp", {});

      const readRecord = async (): Promise<PluginRecord | undefined> => {
        const state = await loadState(locations.extensionRoot);
        return state.marketplaces["mp"]?.plugins["hello"];
      };

      const before = await readRecord();
      assert.ok(before !== undefined);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({ ctx, run, scope: "project", cwd, target: { kind: "all" } });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, MANIFEST_ABSENT_BULK_BODY);
      assert.equal(notifications[0]?.severity, "warning");

      // NFR-1 / NFR-3: the skip returns BEFORE any state mutation, so an
      // interrupted run cannot leave a half-written record behind. Deep
      // equality over the whole record covers the version pin, the resolved
      // source, the compatibility block, and the resource lists at once.
      assert.deepEqual(await readRecord(), before);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updatePlugins preserves a generated skill preload in the staged agent", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-agent-skill-direct-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });
      await seedAgentSkillPreload(seeded.marketplaceRoot);
      const git = createGitOps();
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: DEVICE_CODE,
      });
      const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        gitOps: git.gitOps,
        credentialOps: credentials.credentialOps,
        deviceFlowHttp: deviceFlow.http,
      });

      // assert
      const agent = await readFile(
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md"),
        "utf8",
      );
      assert.match(agent, /^skills: hello-tool$/m);
      assert.match(agent, /^Use \/skill:hello-tool\.$/m);
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
      ]);
      assert.deepEqual(git.state.fetchCalls, []);
      assert.deepEqual(git.state.forceUpdateRefCalls, []);
      assert.deepEqual(git.state.checkoutCalls, []);
      assert.deepEqual(git.state.cloneCalls, []);
      assert.deepEqual(git.state.resolveRefCalls, []);
      assert.deepEqual(git.state.resolveRemoteRefCalls, []);
      assert.deepEqual(credentials.calls, { fill: [], approve: [], reject: [] });
      assert.deepEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin preserves a generated skill preload from its path source", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-agent-skill-cascade-");
    const previousCwd = process.cwd();
    t.after(async () => {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    });
    const locations = locationsFor("project", cwd);
    const seeded = await seedPathMarketplace({
      cwd,
      marketplaceRoot: path.join(cwd, "mp-src"),
      marketplaceName: "mp",
      manifestPlugins: {
        hello: { version: "1.0.1", hasSkill: true, hasAgent: true },
      },
      installedVersions: { hello: "1.0.0" },
    });
    await seedAgentSkillPreload(seeded.marketplaceRoot);
    process.chdir(cwd);

    // act
    const outcome = await updateSinglePlugin("hello", "mp", "project");

    // assert
    const agent = await readFile(
      path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md"),
      "utf8",
    );
    assert.equal(outcome.partition, "updated");
    assert.match(agent, /^skills: hello-tool$/m);
    assert.match(agent, /^Use \/skill:hello-tool\.$/m);
  });
});

test("PROV-02/PROV-03: update never promotes a dependency record's provenance", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-provenance-"));
    const previousCwd = process.cwd();
    t.after(async () => {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    });
    const locations = locationsFor("project", cwd);
    await seedPathMarketplace({
      cwd,
      marketplaceRoot: path.join(cwd, "mp-src"),
      marketplaceName: "mp",
      manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
      installedVersions: { hello: "1.0.0" },
    });
    const seededState = await loadState(locations.extensionRoot);
    const seededRecord = seededState.marketplaces.mp?.plugins.hello;
    assert.ok(seededRecord !== undefined);
    seededRecord.provenance = "dependency";
    await saveState(locations.extensionRoot, seededState);
    process.chdir(cwd);

    // act
    const outcome = await updateSinglePlugin("hello", "mp", "project");

    // assert
    assert.equal(outcome.partition, "updated");
    const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
    assert.ok(record !== undefined);
    assert.deepStrictEqual(record, {
      version: "1.0.1",
      resolvedSource: path.join(cwd, "mp-src", "plugins", "hello"),
      compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
      resources: {
        skills: ["hello-tool"],
        prompts: [],
        agents: [],
        mcpServers: [],
        hooks: [],
        workflows: [],
      },
      enabled: true,
      provenance: "dependency",
      installedAt: seededRecord.installedAt,
      updatedAt: record.updatedAt,
    });
  });
});

test("PDEF-01: update preview detects an agent conflict from a later resolved directory", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-agent-dir-preview-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: false,
            agentDirectories: ["declared-agents"],
            agents: [
              { directory: "declared-agents", sourceName: "first" },
              { sourceName: "later" },
            ],
          },
        },
        installedVersions: { hello: "1.0.0" },
      });
      // D-10-05: the update constraint gate walks every installed record's
      // declarations, fail-closed, before candidate resolution. `other-mp`
      // needs a real, loadable manifest listing `world` so the walk
      // establishes it declares nothing and the update reaches the
      // agent-conflict path this test is about.
      await mkdir(path.join(cwd, "other-mp"), { recursive: true });
      await writeFile(
        path.join(cwd, "other-mp", "marketplace.json"),
        JSON.stringify({
          name: "other-mp",
          plugins: [{ name: "world", source: "./plugins/world", version: "1.0.0" }],
        }),
      );

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["other-mp"] = {
        name: "other-mp",
        scope: "project",
        source: pathSource("./other-mp"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "other-mp", "marketplace.json"),
        marketplaceRoot: path.join(cwd, "other-mp"),
        plugins: {
          world: makePluginRecord("1.0.0", {
            skills: [],
            agents: ["pi-claude-marketplace-hello-later"],
          }),
        },
      };
      await saveState(locations.extensionRoot, state);
      const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.strictEqual(notifications.length, 1);
      assert.strictEqual(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /Cross-plugin name conflict/);
      assert.match(notifications[0]?.message ?? "", /pi-claude-marketplace-hello-later/);
      const after = await loadState(locations.extensionRoot);
      assert.strictEqual(after.marketplaces.mp?.plugins.hello?.version, "1.0.0");
      await assert.rejects(
        () => readFile(path.join(locations.agentsDir, "pi-claude-marketplace-hello-first.md")),
        { code: "ENOENT" },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PDEF-01: update stages every agent directory and warns on a later duplicate", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-agent-dirs-");
    const previousCwd = process.cwd();
    t.after(async () => {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    });
    const locations = locationsFor("project", cwd);
    const seeded = await seedPathMarketplace({
      cwd,
      marketplaceRoot: path.join(cwd, "mp-src"),
      marketplaceName: "mp",
      manifestPlugins: {
        hello: {
          version: "1.0.1",
          hasSkill: false,
          agentDirectories: ["declared-agents"],
          agents: [
            {
              directory: "declared-agents",
              sourceName: "shared-first",
              frontmatterName: "shared",
              body: "First shared agent.\n",
            },
            { sourceName: "later", body: "Later agent.\n" },
            {
              sourceName: "shared-later",
              frontmatterName: "shared",
              body: "Later shared agent.\n",
            },
          ],
        },
      },
      installedVersions: { hello: "1.0.0" },
    });
    const conventionalAgentsDir = path.join(seeded.marketplaceRoot, "plugins", "hello", "agents");
    const expectedWarning =
      `agent source "shared" at "${path.join(conventionalAgentsDir, "shared-later.md")}" duplicates generated name ` +
      '"pi-claude-marketplace-hello-shared" already produced by agent source "shared" at ' +
      `"${path.join(conventionalAgentsDir, "..", "declared-agents", "shared-first.md")}"; keeping first discovered source.`;
    process.chdir(cwd);

    const outcome = await updateSinglePlugin("hello", "mp", "project");

    assert.strictEqual(outcome.partition, "updated");
    assert.deepStrictEqual(outcome.stagingWarnings, [
      { kind: "discovery", message: expectedWarning },
    ]);
    const state = await loadState(locations.extensionRoot);
    assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.agents, [
      "pi-claude-marketplace-hello-shared",
      "pi-claude-marketplace-hello-later",
    ]);
    assert.match(
      await readFile(
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-shared.md"),
        "utf8",
      ),
      /First shared agent\./,
    );
    assert.match(
      await readFile(
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-later.md"),
        "utf8",
      ),
      /Later agent\./,
    );
  });
});

// ─── PUP-2: syncCloneOnce memoization (github-source, gitOps mocked) ───────────

test("PUP-2: two plugins in SAME github marketplace -> syncCloneOnce calls fetch/forceUpdateRef/checkout exactly once", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup2-");
    try {
      // Seed a github marketplace with two installed plugins. The fixture
      // provides a valid marketplace.json under the cloneDir; the resolver
      // will later mark plugin entries as not-installable (no on-disk
      // plugin tree), causing them to land in the 'skipped' partition.
      // PUP-2 cares only about gitOps call counts -- the per-plugin outcome
      // shape is irrelevant here.
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/anthropics/test#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              a: makePluginRecord("0.0.1"),
              b: makePluginRecord("0.0.1"),
            },
          },
        },
      });

      const { ctx, run } = makeCtx();
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });

      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
      });

      // PUP-2: syncCloneOnce memoizes per (scope, marketplace). Even though
      // two plugins live in `official`, each gitOps primitive fires exactly
      // once for the marketplace refresh -- not twice.
      assert.equal(state.fetchCalls.length, 1, "fetch should fire exactly once");
      assert.equal(state.forceUpdateRefCalls.length, 1, "forceUpdateRef should fire exactly once");
      assert.equal(state.checkoutCalls.length, 1, "checkout should fire exactly once");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-2 / AUTH-02: the github marketplace sync fetch carries the github.com auth bundle and a supplied authMemo", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-auth-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const credentialOps = makeCredentialOps();
      const memoized: AuthAttemptResult = { ok: false, reason: "memoized authentication decline" };
      const authMemo = new Map<string, AuthAttemptResult>([["github.com", memoized]]);
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
        credentialOps,
        deviceFlowHttp: makeDeviceFlowHttp(),
        authMemo,
      });

      // assert
      assert.equal(state.fetchCalls.length, 1);
      const auth = state.fetchCalls[0]?.auth;
      assert.ok(auth?.kind === "device-flow");
      assert.equal(auth.host, "github.com");
      assert.equal(auth.credentialOps, credentialOps);
      assert.deepEqual(await auth.onAuthRequired(), memoized);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-02: the GitHub marketplace sync under the override binds the override host", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-override-");
    try {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example:8443/git");
      await seedGithubMarketplaceForSync(cwd);
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const credentialOps = makeCredentialOps();
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
        credentialOps,
        deviceFlowHttp: makeDeviceFlowHttp(),
        authMemo: new Map<string, AuthAttemptResult>(),
      });

      // assert
      assert.deepStrictEqual(
        state.fetchCalls.map(({ auth }) => auth),
        [{ kind: "stored-credential", credentialOps, host: "mirror.example:8443" }],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-03: a GitHub marketplace sync on an invalid base fails the update command", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-invalid-base-");
    try {
      // arrange
      setGitHubBaseUrl(t, "http://mirror.example");
      await seedGithubMarketplaceForSync(cwd);
      const { gitOps, state } = createGitOps();
      const { ctx, verifyBoundary } = createNotificationBoundary(0);

      // act & assert
      await assert.rejects(
        () =>
          updatePlugins({
            ctx,
            run: runWithNothingLoaded(),
            scope: "project",
            cwd,
            target: { kind: "marketplace", marketplace: "official" },
            gitOps,
            credentialOps: makeCredentialOps(),
          }),
        (error: unknown) => {
          assert.deepStrictEqual(
            error,
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          );
          return true;
        },
      );
      assert.deepStrictEqual(state.fetchCalls, []);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-2 / D-79-02: two marketplaces on one Device Flow host without a supplied authMemo request one device code", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-memo-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const locations = locationsFor("project", cwd);
      const secondCloneDir = await locations.sourceCloneDir("second");
      await cp(fixtureMarketplaceDir("valid-marketplace"), secondCloneDir, { recursive: true });
      const seeded = await loadState(locations.extensionRoot);
      const official = seeded.marketplaces.official;
      assert.ok(official !== undefined);
      await saveState(locations.extensionRoot, {
        ...seeded,
        marketplaces: {
          ...seeded.marketplaces,
          second: {
            ...official,
            name: "second",
            source: githubSource("https://github.com/test/other#main"),
            manifestPath: path.join(secondCloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: secondCloneDir,
          },
        },
      });
      const { gitOps: recordingGitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const gitOps: typeof recordingGitOps = {
        ...recordingGitOps,
        async fetch(fetchOptions) {
          if (fetchOptions.auth?.kind === "device-flow") {
            await fetchOptions.auth.onAuthRequired();
          }

          await recordingGitOps.fetch(fetchOptions);
        },
      };
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: DEVICE_CODE,
        defaultPoll: { kind: "access_denied" },
      });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "all" },
        gitOps,
        credentialOps: makeCredentialOps(),
        deviceFlowHttp: deviceFlow.http,
      });

      // assert
      assert.equal(state.fetchCalls.length, 2, "each marketplace syncs once");
      assert.equal(deviceFlow.calls.requestCode.length, 1, "the Device Flow runs once per host");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("syncClone-fail: an HTTP 401 on the marketplace sync renders {authentication required}", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-401-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const unauthorized = Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
        code: "HttpError",
        data: { statusCode: 401, statusMessage: "Unauthorized" },
      });
      const { gitOps } = createGitOps({ fetchThrows: unauthorized });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
        credentialOps: makeCredentialOps(),
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {authentication required}\n    cause: HTTP Error: 401 Unauthorized\n\nPlugin update: 1 failure",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GLK-04: a held scope lock refuses the marketplace sync as lock held before any git write", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-lock-held-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const locations = locationsFor("project", cwd);
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const { ctx, run, notifications } = makeCtx();
      await whileStateLockHeld(locations, async () => {
        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "marketplace", marketplace: "official" },
          gitOps,
          credentialOps: makeCredentialOps(),
        });
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {lock held}\n    cause: Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes. -> Lock file is already being held\n\nPlugin update: 1 failure`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(state.fetchCalls, []);
      assert.deepStrictEqual(state.forceUpdateRefCalls, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GLK-04: a scope lock lost during the marketplace sync fails the sync as lock held", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-lock-lost-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const locations = locationsFor("project", cwd);
      const lost = new StateLockCompromisedError("project", locations.stateLockFile, {
        cause: new Error("Unable to update lock within the stale threshold"),
      });
      const { gitOps } = createGitOps({ fetchThrows: lost });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
        credentialOps: makeCredentialOps(),
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {lock held}\n    cause: The project scope state lock (${locations.stateLockFile}) was lost before the operation finished. Run the command again. -> Unable to update lock within the stale threshold\n\nPlugin update: 1 failure`,
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { title, seed, marketplace, status, statusMessage, message } of [
  {
    title:
      "GLK-01 / D-PL7-14: an HTTP 503 on a github marketplace sync fails as network error framed with the wire url",
    seed: (cwd: string) => seedGithubMarketplaceForSync(cwd),
    marketplace: "official",
    status: 503,
    statusMessage: "Service Unavailable",
    message:
      "A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {network error}\n    cause: 503 on https://github.com/test/repo.git -> HTTP Error: 503 Service Unavailable\n\nPlugin update: 1 failure",
  },
  {
    title:
      "GLK-01 / D-PL7-14: an HTTP 404 on a github marketplace sync fails as network error framed with the wire url",
    seed: (cwd: string) => seedGithubMarketplaceForSync(cwd),
    marketplace: "official",
    status: 404,
    statusMessage: "Not Found",
    message:
      "A plugin operation has failed.\n\n● official [project]\n  ⊘ official (failed) {network error}\n    cause: 404 on https://github.com/test/repo.git -> HTTP Error: 404 Not Found\n\nPlugin update: 1 failure",
  },
  {
    title:
      "GLK-01 / D-PL7-14: an HTTP 502 on a url marketplace sync fails as network error framed with the source url",
    seed: (cwd: string) => seedUrlMarketplaceForSync(cwd, { hello: "1.0.0" }),
    marketplace: "mp",
    status: 502,
    statusMessage: "Bad Gateway",
    message:
      "A plugin operation has failed.\n\n● mp [project]\n  ⊘ mp (failed) {network error}\n    cause: 502 on https://example.com/org/repo -> HTTP Error: 502 Bad Gateway\n\nPlugin update: 1 failure",
  },
] as const) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-sync-http-status-");
      try {
        // arrange
        await seed(cwd);
        const answered = Object.assign(new Error(`HTTP Error: ${status} ${statusMessage}`), {
          code: "HttpError",
          data: { statusCode: status, statusMessage },
        });
        const { gitOps } = createGitOps({ fetchThrows: answered });
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "marketplace", marketplace },
          gitOps,
          credentialOps: makeCredentialOps(),
        });

        // assert
        assert.deepStrictEqual(notifications, [{ message, severity: "error" }]);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("CR-01: an HTTP 401 on a later marketplace sync still reports the earlier target's update", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-401-later-");
    try {
      // arrange
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const zzzClone = await locations.sourceCloneDir("zzz");
      await cp(fixtureMarketplaceDir("valid-marketplace"), zzzClone, { recursive: true });
      const seeded = await loadState(locations.extensionRoot);
      await saveState(locations.extensionRoot, {
        ...seeded,
        marketplaces: {
          ...seeded.marketplaces,
          zzz: {
            name: "zzz",
            scope: "project",
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(zzzClone, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: zzzClone,
            plugins: { hello: makePluginRecord("1.0.0") },
          },
        },
      });
      const unauthorized = Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
        code: "HttpError",
        data: { statusCode: 401, statusMessage: "Unauthorized" },
      });
      const { gitOps } = createGitOps({ fetchThrows: unauthorized });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "all" },
        gitOps,
        credentialOps: makeCredentialOps(),
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● zzz [project]\n  ⊘ zzz (failed) {authentication required}\n    cause: HTTP Error: 401 Unauthorized\n\nPlugin update: 1 failure",
          severity: "error",
        },
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes",
        },
      ]);
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces.mp?.plugins.hello?.version, "1.0.1");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── NFR-5: path-source update -> zero gitOps calls ────────────────────────────

test("NFR-5: path-source marketplace update calls zero gitOps primitives", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-nfr5-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run } = makeCtx();
      const { gitOps, state } = createGitOps();

      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
      });

      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.forceUpdateRefCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
      assert.equal(state.resolveRefCalls.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-04: a path-only update ignores an invalid override", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-path-override-");
    try {
      // arrange
      setGitHubBaseUrl(t, "http://mirror.example");
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, run, notifications } = makeCtx();
      const { gitOps, state } = createGitOps();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [{ message: "Plugin update: nothing to update" }]);
      assert.deepStrictEqual(
        {
          fetch: state.fetchCalls.length,
          forceUpdateRef: state.forceUpdateRefCalls.length,
          checkout: state.checkoutCalls.length,
          resolveRef: state.resolveRefCalls.length,
        },
        { fetch: 0, forceUpdateRef: 0, checkout: 0, resolveRef: 0 },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-2: url-source marketplaces refresh like github ones ───────────────────

/**
 * Seed a url-source marketplace whose clone holds `versions`. plugin.json
 * carries no version, so a manifest rewrite moves the derived version.
 */
async function seedUrlMarketplaceForSync(
  cwd: string,
  versions: Readonly<Record<string, string>>,
  source: ParsedSource = parsePluginSource("https://example.com/org/repo#main"),
): Promise<{ readonly manifestPath: string }> {
  const locations = locationsFor("project", cwd);
  const cloneDir = await locations.sourceCloneDir("mp");
  const { manifestPath } = await seedPathMarketplace({
    cwd,
    marketplaceRoot: cloneDir,
    marketplaceName: "mp",
    manifestPlugins: Object.fromEntries(
      Object.entries(versions).map(([name, version]) => [
        name,
        { version, omitPluginJsonVersion: true },
      ]),
    ),
    installedVersions: { ...versions },
  });
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces.mp;
  assert.ok(record !== undefined);
  await saveState(locations.extensionRoot, {
    ...state,
    marketplaces: {
      mp: { ...record, source },
    },
  });
  return { manifestPath };
}

test("PUP-2 / GAUTH-03: two plugins in one url marketplace -> one sync fetch carrying the url host's auth bundle", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-url-sync-");
    try {
      // arrange
      await seedUrlMarketplaceForSync(cwd, { a: "1.0.0", b: "1.0.0" });
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const credentialOps = makeCredentialOps();
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
        credentialOps,
      });

      // assert
      assert.equal(state.fetchCalls.length, 1);
      assert.equal(state.forceUpdateRefCalls.length, 1);
      assert.equal(state.checkoutCalls.length, 1);
      assert.deepStrictEqual(state.fetchCalls[0], {
        dir: await locationsFor("project", cwd).sourceCloneDir("mp"),
        remote: "origin",
        ref: "main",
        auth: { credentialOps, host: "example.com", kind: "stored-credential" },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-2 / D-79-02: a url marketplace on a Device Flow host shares a supplied authMemo", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-url-provider-");
    try {
      // arrange
      await seedUrlMarketplaceForSync(
        cwd,
        { hello: "1.0.0" },
        parsePluginSource("https://gitlab.com/org/repo#main"),
      );
      const { gitOps, state } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const credentialOps = makeCredentialOps();
      const memoized: AuthAttemptResult = { ok: false, reason: "memoized authentication decline" };
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
        credentialOps,
        deviceFlowHttp: makeDeviceFlowHttp(),
        authMemo: new Map([["gitlab.com", memoized]]),
      });

      // assert
      const auth = state.fetchCalls[0]?.auth;
      assert.ok(auth?.kind === "device-flow");
      assert.equal(auth.host, "gitlab.com");
      assert.equal(auth.credentialOps, credentialOps);
      assert.deepEqual(await auth.onAuthRequired(), memoized);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("syncClone-fail / GAUTH-04: an HTTP 401 on a url marketplace sync names the missing credential", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-url-sync-401-");
    try {
      // arrange
      await seedUrlMarketplaceForSync(cwd, { hello: "1.0.0" });
      const unauthorized = Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
        code: "HttpError",
        data: { statusCode: 401, statusMessage: "Unauthorized" },
      });
      const { gitOps } = createGitOps({ fetchThrows: unauthorized });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        gitOps,
        credentialOps: makeCredentialOps(),
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ mp (failed) {authentication required}\n    cause: HTTP Error: 401 Unauthorized -> no credential was obtained for example.com; store one with: printf 'protocol=https\\nhost=example.com\\nusername=<user>\\npassword=<token>\\n\\n' | git credential approve\n\nPlugin update: 1 failure",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-2: a url marketplace whose remote advanced -> update reads the refreshed manifest", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-url-advance-");
    try {
      // arrange
      const { manifestPath } = await seedUrlMarketplaceForSync(cwd, { hello: "1.0.0" });
      const fake = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      // The fetch is what brings the new manifest into the clone.
      const gitOps: typeof fake.gitOps = {
        ...fake.gitOps,
        async fetch(fetchOptions) {
          await fake.gitOps.fetch(fetchOptions);
          await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.10" } });
        },
      };
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        gitOps,
        credentialOps: makeCredentialOps(),
      });

      // assert
      const state = await loadState(locationsFor("project", cwd).extensionRoot);
      assert.equal(state.marketplaces.mp?.plugins.hello?.version, "1.0.10");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NFR-5: a path marketplace edited on disk -> update reads the edit in place with no git call", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-path-edit-");
    try {
      // arrange
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", omitPluginJsonVersion: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { gitOps, state } = createGitOps();
      const { ctx, run } = makeCtx();
      const update = (): Promise<void> =>
        updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          gitOps,
        });
      // A first run loads the manifest, so the second run proves the edit is
      // not served from that earlier read.
      await update();
      await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.10" } });

      // act
      await update();

      // assert
      const recorded = await loadState(locationsFor("project", cwd).extensionRoot);
      assert.equal(recorded.marketplaces.mp?.plugins.hello?.version, "1.0.10");
      assert.equal(state.fetchCalls.length, 0);
      assert.equal(state.checkoutCalls.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 partitioning across @mp form ────────────────────────────────────────

test("PUP-1 @mp form: enumerates all installed plugins in the marketplace, partitions accordingly", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup1-mp-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // Bumped: one plugin updated; one unchanged.
          alpha: { version: "1.0.1", hasSkill: true },
          beta: { version: "1.0.0", hasSkill: true },
        },
        installedVersions: { alpha: "1.0.0", beta: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // Catalog `single-mp-mixed` shape: alpha (updated) under one marketplace
      // header. UGRM-01: the `beta (skipped) {up-to-date}` row is suppressed for
      // the bulk (`@mp`, plural) form -- only the realized transition renders.
      // Plugin-row `[<scope>]` brackets suppressed by orphan-fold. The (updated)
      // row has no soft-dep markers (plugin declares no agents / no mcp; the
      // @mp fixture sets only `hasSkill: true`). UGRM-02: the trailing tally
      // counts realized transitions only -- one `updated` row -> `1 updated`
      // (the verb has no plural-s); the suppressed up-to-date row does not
      // inflate the count.
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "Plugin update: 1 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Severity routes to `error` if any failed; here no failed and no
      // manual-recovery. The only skip row is benign (`beta` skipped
      // `up-to-date`, in BENIGN_REASONS) and the `alpha (updated)` row is a
      // success, so per UXG-02 / D-28-06 the whole cascade computes info (no
      // severity arg).
      assert.equal(notifications[0]?.severity, undefined);
      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── UGRM-02: plural tally counts every realized transition ───────────────────

test("UGRM-02: bulk @mp update with TWO realized transitions tallies `2 updated` (verb invariant, no plural-s)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tally-2updated-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // Both bumped -> two realized `updated` transitions, no obstacles.
          alpha: { version: "1.0.1", hasSkill: true },
          beta: { version: "1.0.1", hasSkill: true },
        },
        installedVersions: { alpha: "1.0.0", beta: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // UGRM-02: the trailing tally counts realized transitions -- two `updated`
      // rows -> `2 updated`. The verb has no plural-s (the count carries the
      // plurality). The realized-transition cascade appends the reload trailer.
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "  ● beta v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "Plugin update: 2 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Two benign success rows, no failures/warnings -> info (severity unset).
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-8: reload hint suppressed when 0 updated ──────────────────────────────

test("PUP-8: no plugin updated -> no reload hint", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup8-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      assert.equal(
        body.includes("/reload to pick up changes"),
        false,
        "no reload hint when 0 updated",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-9 cascade: updateSinglePlugin NEVER throws ────────────────────────────

test("PUP-9 cascade: updateSinglePlugin on missing marketplace returns partition='skipped' (does NOT throw)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup9-casc-");
    try {
      // No state seeded -- marketplace absent. The cascade-safe contract
      // says: capture into partition='failed' OR 'skipped' depending on
      // failure shape, but NEVER throw.
      // Run from inside cwd to align process.cwd() with the scope root.
      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("ghost", "ghost-mp", "project");
        // Marketplace-absent is a 'skipped' outcome (pre-phase short-circuit).
        assert.equal(outcome.partition, "skipped");
        assert.equal(outcome.name, "ghost");
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-9 cascade vs direct: catastrophic resolver failure routes differently", async () => {
  // Cascade path: catastrophic phase-2-or-earlier throw (e.g. corrupt
  // manifest at the marketplaceRoot) returns partition='failed' instead
  // of throwing. Direct path on the same input fires notifyError.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup9-route-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Corrupt the manifest so loadCachedMarketplaceManifest throws.
      await writeFile(seeded.manifestPath, "{ this is not json");

      // Cascade: must NOT throw; returns failed outcome.
      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const cascadeOutcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(cascadeOutcome.partition, "failed");
        assert.equal(cascadeOutcome.name, "hello");
        assert.ok((cascadeOutcome.notes ?? []).length > 0);
      } finally {
        process.chdir(prevCwd);
      }

      // Direct: fires notifyError with the chained cause.
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const errs = notifications.filter((n) => n.severity === "error");
      assert.ok(errs.length >= 1, "direct path must fire notifyError on phase-2-or-earlier throw");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-6: phase-3 failure -- RECOVERY_PLUGIN_REINSTALL_PREFIX in body ───────

test("updateSinglePlugin classifies a missing manifest path as source missing", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-manifest-missing-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const state = await loadState(locations.extensionRoot);
      const marketplace = state.marketplaces["mp"];
      assert.ok(marketplace !== undefined);
      marketplace.manifestPath = path.join(cwd, "missing", "marketplace.json");
      await saveState(locations.extensionRoot, state);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["source missing"]);
      assert.match(outcome.notes?.[0] ?? "", /ENOENT/);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin classifies a manifest beneath a file as source missing", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-manifest-notdir-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const blockingFile = path.join(cwd, "manifest-parent");
      await writeFile(blockingFile, "not a directory");
      const state = await loadState(locations.extensionRoot);
      const marketplace = state.marketplaces["mp"];
      assert.ok(marketplace !== undefined);
      marketplace.manifestPath = path.join(blockingFile, "marketplace.json");
      await saveState(locations.extensionRoot, state);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["source missing"]);
      assert.match(outcome.notes?.[0] ?? "", /ENOTDIR/);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin classifies an unreadable manifest as permission denied", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-manifest-denied-");
    const previousCwd = process.cwd();
    let manifestPath: string | undefined;
    try {
      // arrange
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      manifestPath = seeded.manifestPath;
      await chmod(manifestPath, 0o000);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["permission denied"]);
      assert.match(outcome.notes?.[0] ?? "", /EACCES|EPERM/);
    } finally {
      process.chdir(previousCwd);
      if (manifestPath !== undefined) {
        await chmod(manifestPath, 0o600).catch(() => undefined);
      }

      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FLR-02: updateSinglePlugin under a held state lock fails as lock held with the lock cause", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-lock-held-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      process.chdir(cwd);
      const outcome = await whileStateLockHeld(locations, async () => {
        // act
        return updateSinglePlugin("hello", "mp", "project");
      });

      // assert
      assert.ok(outcome.partition === "failed");
      const { cause, ...failure } = outcome;
      const lockMessage = `Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes.`;
      assert.deepStrictEqual(failure, {
        partition: "failed",
        name: "hello",
        // UPR-03: the lock is hit at the intent mark, after the candidate.
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        notes: [`${lockMessage}\n\ncause: ${lockMessage} -> Lock file is already being held`],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["lock held"],
      });
      assert.ok(cause instanceof StateLockHeldError);
      assert.deepStrictEqual(
        [cause.message, cause.scope, cause.lockPath],
        [lockMessage, "project", locations.stateLockFile],
      );
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FLR-02: an autoupdate cascade fails a plugin whose state lock was lost as lock held with the lock cause", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-lock-lost-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      process.chdir(cwd);
      const lost = new StateLockCompromisedError("project", locations.stateLockFile, {
        cause: new Error("Unable to update lock within the stale threshold"),
      });
      const { ctx, run } = makeCtx();
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        undefined,
        {},
        () => Promise.reject(lost),
      );

      // act
      const outcome = await operations.beginPluginUpdateRun({ ctx, run })("hello", "mp", "project");

      // assert
      assert.ok(outcome.partition === "failed");
      const { cause, ...failure } = outcome;
      const lostMessage = `The project scope state lock (${locations.stateLockFile}) was lost before the operation finished. Run the command again.`;
      assert.deepStrictEqual(failure, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        notes: [
          `${lostMessage}\n\ncause: ${lostMessage} -> Unable to update lock within the stale threshold`,
        ],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["lock held"],
      });
      assert.strictEqual(cause, lost);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin classifies a plugin removed after preflight as concurrently uninstalled", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-preflight-uninstalled-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const concurrentWriter = mutateAtFirstLockedLoad((state) => {
        const marketplace = state.marketplaces["mp"];
        assert.ok(marketplace !== undefined);
        delete marketplace.plugins["hello"];
        chmodSync(locations.skillsStagingDir, 0o500);
      });
      process.chdir(cwd);

      // act
      const outcome = await concurrentWriter.updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(concurrentWriter.fired(), true);
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["concurrently uninstalled"]);
      assert.match(outcome.notes?.[0] ?? "", /concurrently uninstalled/);
      assert.ok(outcome.cause instanceof CleanupContextError);
      assert.equal(outcome.cause.primary.name, "PluginUpdateConcurrencyError");
      const cleanupFailure = outcome.cleanupFailures?.[0];
      assert.ok(cleanupFailure !== undefined);
      const residualNames = await readdir(locations.skillsStagingDir);
      assert.equal(residualNames.length, 1);
      assert.deepStrictEqual(cleanupFailure, {
        phase: "abort",
        artifact: "skills",
        path: path.join(locations.skillsStagingDir, residualNames[0]!),
        cause: cleanupFailure.cause,
      });
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"],
        undefined,
      );
    } finally {
      process.chdir(previousCwd);
      const locations = locationsFor("project", cwd);
      await chmod(locations.skillsStagingDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin classifies a version changed after preflight as concurrently updated", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-preflight-updated-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: false, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const initialState = await loadState(locations.extensionRoot);
      const initialRecord = initialState.marketplaces["mp"]?.plugins["hello"];
      assert.ok(initialRecord !== undefined);
      initialRecord.resources.skills = [];
      await saveState(locations.extensionRoot, initialState);
      const concurrentWriter = mutateAtFirstLockedLoad((state) => {
        const record = state.marketplaces["mp"]?.plugins["hello"];
        assert.ok(record !== undefined);
        record.version = "1.0.9";
      });
      process.chdir(cwd);

      // act
      const outcome = await concurrentWriter.updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(concurrentWriter.fired(), true);
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["concurrently updated"]);
      assert.match(outcome.notes?.[0] ?? "", /concurrently updated/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.version,
        "1.0.9",
      );
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a hooks source corrupted after intent marking becomes an ordered phase failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-hooks-reparse-race-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hooksJson: {
              hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo ok" }] }] },
            },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });
      const hooksPath = path.join(
        seeded.marketplaceRoot,
        "plugins",
        "hello",
        "hooks",
        "hooks.json",
      );
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          writeFileSync(hooksPath, "{ invalid hooks");
        },
      );
      const { ctx, run, notifications } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /hooks/);
      assert.match(notifications[0]?.message ?? "", /re-parse failed/);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.equal(record?.version, "1.0.0");
      assert.equal(record?.compatibility.installable, false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a marketplace removed after intent marking is not recreated during finalize", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-finalize-marketplace-race-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          writeFileSync(
            locations.stateJsonPath,
            JSON.stringify({ schemaVersion: 1, marketplaces: {} }),
          );
        },
      );
      const { ctx, run, notifications } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /\{rollback partial\}/);
      assert.match(notifications[0]?.message ?? "", /Marketplace "mp" disappeared/);
      assert.deepEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a plugin removed after intent marking is not recreated during finalize", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-finalize-plugin-race-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        (state) => {
          const marketplace = state.marketplaces["mp"];
          assert.ok(marketplace !== undefined);
          delete marketplace.plugins["hello"];
          writeFileSync(locations.stateJsonPath, JSON.stringify(state));
        },
      );
      const { ctx, run, notifications } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /\{rollback partial\}/);
      assert.match(notifications[0]?.message ?? "", /concurrently uninstalled during finalize/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"],
        undefined,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a skills staging cleanup leak becomes a rollback partial and retry converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-skills-cleanup-leak-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          chmodSync(locations.skillsStagingDir, 0o500);
        },
      );
      const first = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(first.notifications.length, 1);
      assert.equal(first.notifications[0]?.severity, "error");
      assert.match(
        first.notifications[0]?.message ?? "",
        /failed to clean up skills staging directory/,
      );
      assert.match(first.notifications[0]?.message ?? "", /\{rollback partial\}/);
      await chmod(locations.skillsStagingDir, 0o700);
      const retry = makeCtx();
      await updatePlugins({
        ctx: retry.ctx,
        run: retry.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      assert.equal(retry.notifications.length, 1);
      assert.match(retry.notifications[0]?.message ?? "", /\(updated\)/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.version,
        "1.0.1",
      );
    } finally {
      const locations = locationsFor("project", cwd);
      await chmod(locations.skillsStagingDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an agents staging cleanup leak becomes a rollback partial and retry converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-agents-cleanup-leak-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          chmodSync(locations.agentsStagingDir, 0o500);
        },
      );
      const first = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(first.notifications.length, 1);
      assert.equal(first.notifications[0]?.severity, "error");
      assert.match(
        first.notifications[0]?.message ?? "",
        /failed to clean up agents staging directory/,
      );
      assert.match(first.notifications[0]?.message ?? "", /\{rollback partial\}/);
      await chmod(locations.agentsStagingDir, 0o700);
      const retry = makeCtx();
      await updatePlugins({
        ctx: retry.ctx,
        run: retry.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      assert.equal(retry.notifications.length, 1);
      assert.match(retry.notifications[0]?.message ?? "", /\(updated\)/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.version,
        "1.0.1",
      );
    } finally {
      const locations = locationsFor("project", cwd);
      await chmod(locations.agentsStagingDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const cleanupCase of [
  {
    artifact: "skills",
    manifest: { version: "1.0.1", hasSkill: true },
    stagingRoot: (locations: ReturnType<typeof locationsFor>) => locations.skillsStagingDir,
    label: "skills staging directory",
  },
  {
    artifact: "commands",
    manifest: { version: "1.0.1", hasCommand: true },
    stagingRoot: (locations: ReturnType<typeof locationsFor>) => locations.commandsStagingDir,
    label: "commands staging directory",
  },
  {
    artifact: "agents",
    manifest: { version: "1.0.1", hasAgent: true },
    stagingRoot: (locations: ReturnType<typeof locationsFor>) => locations.agentsStagingDir,
    label: "agents staging directory",
  },
] as const) {
  test(`a ${cleanupCase.artifact} commit cleanup failure retains an exact structured descriptor`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir(`update-${cleanupCase.artifact}-context-`);
      const previousCwd = process.cwd();
      const locations = locationsFor("project", cwd);
      const stagingRoot = cleanupCase.stagingRoot(locations);
      try {
        // arrange
        await seedPathMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          manifestPlugins: { hello: cleanupCase.manifest },
          installedVersions: { hello: "1.0.0" },
        });
        const stateWatch = observeStateTransition(
          (state) =>
            state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
              "update-in-progress",
            ) === true,
          () => {
            chmodSync(stagingRoot, 0o500);
          },
        );
        process.chdir(cwd);

        // act
        const outcome = await stateWatch.updateSinglePlugin("hello", "mp", "project");

        // assert
        assert.equal(outcome.partition, "failed");
        assert.equal(stateWatch.fired(), true);
        assert.ok(outcome.partition === "failed");
        const phaseFailure = outcome.phaseFailures?.find(
          ({ phase }) => phase === cleanupCase.artifact,
        );
        assert.ok(phaseFailure !== undefined);
        const cleanupFailure = phaseFailure.cleanupFailures?.[0];
        assert.ok(cleanupFailure !== undefined);
        const residualNames = await readdir(stagingRoot);
        assert.equal(residualNames.length, 1);
        const expectedPath = path.join(stagingRoot, residualNames[0]!);
        assert.deepStrictEqual(cleanupFailure, {
          phase: "commit",
          artifact: cleanupCase.artifact,
          path: expectedPath,
          cause: cleanupFailure.cause,
        });
        assert.ok(cleanupFailure.cause instanceof Error);
        assert.match(cleanupFailure.cause.message, new RegExp(cleanupCase.label));
        assert.equal(Object.isFrozen(cleanupFailure), true);
        assert.equal(Object.isFrozen(phaseFailure.cleanupFailures), true);
      } finally {
        process.chdir(previousCwd);
        await chmod(stagingRoot, 0o700).catch(() => undefined);
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("an MCP commit permission failure becomes a rollback partial and retry converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-mcp-commit-denied-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasMcp: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          chmodSync(path.dirname(locations.mcpAdapterJsonPath), 0o500);
        },
      );
      const first = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(first.notifications.length, 1);
      assert.equal(first.notifications[0]?.severity, "error");
      assert.match(first.notifications[0]?.message ?? "", /\[mcp\] \(rollback failed\)/);
      assert.match(first.notifications[0]?.message ?? "", /EACCES|EPERM/);
      await chmod(path.dirname(locations.mcpAdapterJsonPath), 0o700);
      const retry = makeCtx();
      await updatePlugins({
        ctx: retry.ctx,
        run: retry.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      assert.equal(retry.notifications.length, 1);
      assert.match(retry.notifications[0]?.message ?? "", /\(updated\)/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.version,
        "1.0.1",
      );
    } finally {
      const locations = locationsFor("project", cwd);
      await chmod(path.dirname(locations.mcpAdapterJsonPath), 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-6 / D-18-10 phase-3 failure: bridge commit throws -> aggregate error tells the user to run reinstall", async (testContext) => {
  // The cleanest way to force a phase-3a failure deterministically is to
  // pre-create an UNWRITEABLE file at the target path where the skills
  // bridge would `rename(staging -> target)`. On most filesystems that
  // succeeds (rename overwrites a file with a dir), so instead we force
  // a target-dir collision by pre-creating the skill TARGET as a FILE
  // (rename(dir -> file) returns ENOTDIR on Linux/macOS).
  //
  // NOTE: this is a defensive test -- the actual phase-3a aggregation
  // contract is that ANY commit-time throw lands in failures[]. We use
  // the file-vs-dir filesystem collision as one reliable trigger.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup6-fail-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the skills target as a file (NOT a dir). The bridge's
      // commitPreparedSkills calls `rm` then `mkdir(..., {recursive:true})`
      // on the target ROOT, but the per-skill rename overwrites the target
      // path. Place the obstacle one level deeper to force EEXIST/ENOTDIR
      // at rename time: a *FILE* at the path the bridge wants to rename
      // *into*. The bridge skills target shape is
      // `<skillsTargetDir>/<generatedName>/` -- so we pre-create
      // `<skillsTargetDir>/hello-tool` as a FILE.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      const { ctx, run, notifications } = makeCtx();
      const completionCache = createCompletionCache();
      const drop = testContext.mock.method(completionCache, "dropMarketplaceCache");
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // CR-01: phase-3a aggregate failure must fire EXACTLY ONE
      // notification. A duplicate emission would be one from the inline
      // `notifyDirectFailure` inside `runThreePhaseUpdate`, a second from
      // the cascade `renderUpdateCascadeAndNotify` walk after the outcome
      // fell through to `outcomes[]`. `update.ts::updatePlugins`
      // early-returns when the outcome carries `phaseFailures`, so a
      // regression would surface here as `notifications.length === 2`.
      assert.equal(
        notifications.length,
        1,
        `expected exactly one notification for phase-3a aggregate failure, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      // The recovery hint marker is carried by the inline
      // `notifyDirectFailure` emission's `aggregate` cause text.
      const allText = notifications[0]?.message ?? "";
      assert.match(
        allText,
        /Run \/claude:plugin reinstall hello@mp to repair it\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint in notification:\n${allText}`,
      );

      // TR-04 SC#1/SC#2 post-state: PUP-6 phase-3 failure is
      // a skills-only-fail; commands + agents + mcp succeed (the seed
      // declares no entries for those bridges so they each produce an
      // empty `recorded[]` array). The intent-mark survives on failure;
      // version stays at fromVersion; failed bridge's resources stay at
      // pre-update value; successful bridges still hit the
      // `!failedPhases.has(bridge)` write path producing empty arrays
      // (byte-identical to pre-update but exercising the gate).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined, "plugin record must survive partial failure");
      assert.equal(rec.version, "1.0.0", "version must NOT bump on failure");
      assert.equal(
        rec.compatibility.installable,
        false,
        "installable must be false during/after failure",
      );
      assert.ok(
        rec.compatibility.notes.includes("update-in-progress"),
        "intent-mark marker must survive failure",
      );
      assert.deepEqual(
        [...rec.resources.skills],
        ["seeded-skill"],
        "failed bridge resources stay at pre-update value",
      );
      assert.deepEqual(
        [...rec.resources.prompts],
        [],
        "commands had no manifest entry -> empty array (succeeded bridge wrote [])",
      );
      assert.deepEqual(
        [...rec.resources.agents],
        [],
        "agents had no manifest entry -> empty array",
      );
      assert.deepEqual(
        [...rec.resources.mcpServers],
        [],
        "mcp had no manifest entry -> empty array",
      );
      assert.strictEqual(drop.mock.callCount(), 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── WR-01: phase-3a abort with up-to-date predecessors -> no spurious no-op ──

test("WR-01: bulk update where an up-to-date plugin precedes a phase-3a failure does NOT emit 'nothing to update'", async () => {
  // A bulk (`@mp`, plural) update enumerates `aaa` (up-to-date, partition
  // `unchanged`) BEFORE `zzz` (bumped, but phase-3a-fails on a skill-target
  // collision). State insertion order (`Object.keys(mp.plugins)`) is the
  // `installedVersions` key order, so `aaa` is accumulated into `outcomes`
  // (then bulk-suppressed) before `zzz` aborts the batch.
  //
  // The failing plugin fires its own `notifyDirectFailure` and is withheld from
  // `outcomes`, so the abort path renders a cascade for the already-accumulated
  // `aaa` outcome. Without the `abortedByFailure` guard that all-`unchanged`
  // accumulator passes the no-op gate (0 updated, 0 error/warning rows in the
  // cascade) and emits a SECOND notification reading `Plugin update: nothing to
  // update` -- contradictory, directly after a failure for the same
  // invocation. The `abortedByFailure`
  // flag now suppresses that headline.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr01-abort-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // aaa: manifest version == installed version -> unchanged.
          aaa: { version: "1.0.0", hasSkill: true },
          // zzz: bumped -> realized transition attempted, but phase-3a fails.
          zzz: { version: "1.0.1", hasSkill: true },
        },
        // Insertion order seeds state.plugins as [aaa, zzz] so enumeration
        // accumulates the unchanged `aaa` outcome before `zzz` aborts.
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });

      // Force the phase-3a failure for `zzz` only: pre-create its skill TARGET
      // as a FILE so the bridge's `rename(stagingDir -> target)` returns ENOTDIR
      // (the PUP-6 mechanism). The generated skill name is `<plugin>-<skillDir>`
      // = `zzz-tool`. `aaa` has no obstacle, so it cleanly partitions unchanged.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "zzz-tool"), "obstacle");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // Exactly one notification: the `zzz` phase-3a failure. The spurious
      // `nothing to update` headline must NOT be emitted on the abort path.
      assert.equal(
        notifications.length,
        1,
        `expected exactly one (failure) notification, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      const allText = notifications.map((n) => n.message).join("\n");
      assert.equal(
        allText.includes("Plugin update: nothing to update"),
        false,
        `must NOT emit the no-op headline after a phase-3a abort:\n${allText}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a CLEANLY-UPDATED predecessor before a phase-3a abort stays visible -- the failure notification AND the committed `(updated)` cascade both render", async () => {
  // Companion of the up-to-date-predecessor WR-01 case above: there `aaa` was
  // `unchanged` (bulk-suppressed -> empty cascade -> nothing rendered). Here
  // `aaa` is a REALIZED transition (bumped, commits cleanly) accumulated BEFORE
  // `zzz` aborts on a skill-target collision. The abort path must still render
  // the committed `aaa (updated)` row so a successful predecessor update never
  // vanishes behind the failure.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr01-abort-committed-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // aaa: bumped, no obstacle -> commits cleanly (realized `updated`).
          aaa: { version: "1.0.1", hasSkill: true },
          // zzz: bumped, but phase-3a fails on the pre-created skill-target file.
          zzz: { version: "1.0.1", hasSkill: true },
        },
        // Insertion order seeds state.plugins as [aaa, zzz] so `aaa` is committed
        // and accumulated into `outcomes` before `zzz` aborts the batch.
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });

      // Force the phase-3a failure for `zzz` only: pre-create its skill TARGET
      // (`zzz-tool`) as a FILE so the bridge's `rename(staging -> target)`
      // returns ENOTDIR. `aaa`'s target (`aaa-tool`) is unobstructed.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "zzz-tool"), "obstacle");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // Exactly two notifications: the `zzz` phase-3a failure (inline
      // notifyDirectFailure) AND the abort cascade for the committed `aaa`.
      assert.equal(
        notifications.length,
        2,
        `expected 2 notifications, got ${notifications.length.toString()}: ${notifications.map((n) => n.message).join("\n---\n")}`,
      );
      const failure = notifications.find((n) =>
        n.message.includes("Run /claude:plugin reinstall zzz@mp to repair it."),
      );
      assert.ok(failure !== undefined, "the zzz phase-3a failure notification must be present");
      const cascade = notifications.find((n) =>
        n.message.includes("● aaa v1.0.0 → v1.0.1 (updated)"),
      );
      assert.ok(cascade !== undefined, "the committed aaa (updated) cascade must be present");
      // The committed predecessor still tallies as a realized transition.
      assert.match(cascade.message, /Plugin update: 1 updated/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-7 / WR-04: success populates stagedAgentNames + stagedMcpServerNames ─────────

test("WR-04: successful update populates stagedAgentNames + stagedMcpServerNames on outcome", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr04-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true, hasMcp: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        assert.equal(outcome.fromVersion, "1.0.0");
        assert.equal(outcome.toVersion, "1.0.1");
        assert.ok(outcome.stagedAgentNames !== undefined);
        assert.ok(outcome.stagedAgentNames.length > 0, "stagedAgentNames must be populated");
        assert.ok(outcome.stagedMcpServerNames !== undefined);
        assert.ok(
          outcome.stagedMcpServerNames.length > 0,
          "stagedMcpServerNames must be populated",
        );
      } finally {
        process.chdir(prevCwd);
      }

      // TR-04: outcome-shape assertions don't
      // exercise on-disk state, so lock the all-success finalize contract
      // explicitly. Load state via the project-scope locations resolved
      // from the same cwd that drove updateSinglePlugin.
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.1");
      assert.equal(rec.compatibility.installable, true);
      assert.ok(
        !rec.compatibility.notes.includes("update-in-progress"),
        "intent-mark marker must NOT leak into the all-success state",
      );
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.agents], ["pi-claude-marketplace-hello-bot"]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);

      assert.ok(seeded.marketplaceRoot.length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── SEV-03 / D-69-01: autoupdate cascade TAKES the partial path ─────────────

test("SEV-03 / D-69-01: autoupdate cascade (updateSinglePlugin) TAKES the partial path -- a `partially-available` candidate degrades to partition='updated' carrying unsupportedKinds (NOT skipped)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sev03-partial-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Make the candidate re-resolve `partially-available`: an `lspServers` component
      // (the `.lsp.json` convention) is a known-but-unsupported kind. The skill
      // stays supported, so the candidate DEGRADES rather than going
      // structurally `unavailable` -- the partial path can materialize it.
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        // The dropped kind rides the outcome so the cascade mapper renders
        // `(partially-installed) {lsp}`.
        assert.deepEqual([...(outcome.partialDegrade?.kinds ?? [])], ["lspServers"]);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / FORCE-05: autoupdate cascade does NOT bypass a hard failure -- an npm-source (`unavailable`) candidate still returns partition='skipped' {no longer installable}", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-sev03-unavail-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // MM-3 / PR-2: an npm-source entry from a path marketplace is
        // structurally `unavailable` -- `requirePartialInstallable` blocks it even
        // on the partial path (`--partial` degrades `partially-available`, never
        // `unavailable`).
        manifestPlugins: {
          hello: {
            version: "1.1.0",
            hasSkill: true,
            rawSourceOverride: { source: "npm", package: "some-pkg" },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        // act
        const outcome = await updateSinglePlugin("hello", "mp", "project");

        // assert
        assert.equal(outcome.partition, "skipped");
        if (outcome.partition !== "skipped") {
          throw new Error("unreachable: narrowed above");
        }

        assert.deepEqual([...outcome.reasons], ["no longer installable"]);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("XSURF-03 / SEV-04: the manual `update` path (no --partial) of a partially-upgradable candidate declines with `(partially-upgradable) {lsp}` + the --partial trailer at warning", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sev03-manual-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // XSURF-03: the manual no-`--partial` decline of a partially-upgradable
      // candidate flips to the resolver-state-driven `(partially-upgradable)` token
      // (consistent with how `list` describes the same plugin) carrying the
      // list-consistent `{lsp}` degrade reason + the update-worded `--partial`
      // trailer. SEV-04: a targeted decline stays warning.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (partially-upgradable) {lsp}\n    Re-run with --partial to update with the supported components.",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / D-69-01: prior-state read -- a previously-CLEAN plugin (persisted unsupported empty) degraded by the autoupdate cascade carries newlyDegraded=true", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sev03-newly-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        // seedPathMarketplace seeds compatibility.unsupported = [] -> the prior
        // record is CLEAN, so the degrade is NEWLY introduced.
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        assert.equal(outcome.partialDegrade?.newlyDegraded, true);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SEV-03 / D-69-01: prior-state read -- an ALREADY partially-installed plugin (persisted unsupported non-empty) degraded again carries newlyDegraded=false", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sev03-already-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", ".lsp.json"),
        JSON.stringify({ servers: {} }),
      );

      // Pre-stamp the persisted record as ALREADY partially-installed: a non-empty
      // `compatibility.unsupported` is the prior-state the auto-update reads.
      const locations = locationsFor("project", cwd);
      const before = await loadState(locations.extensionRoot);
      const rec = before.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      rec.compatibility.unsupported = ["lspServers"];
      await saveState(locations.extensionRoot, before);

      const prevCwd = process.cwd();
      process.chdir(cwd);
      try {
        const outcome = await updateSinglePlugin("hello", "mp", "project");
        assert.equal(outcome.partition, "updated");
        if (outcome.partition !== "updated") {
          throw new Error("unreachable: narrowed above");
        }

        assert.equal(outcome.partialDegrade?.newlyDegraded, false);
      } finally {
        process.chdir(prevCwd);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 pl@mp form: not-installed plugin -> partition='failed' ──────────────

test("PUP-1 / UPR-04 pl@mp: targeting a plugin not in state -> partition='failed' (not installed)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup1-pl-noinstall-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        // No installedVersions -> hello not in state.
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // V2 byte form. Plugin-row `[<scope>]` bracket suppressed by orphan-fold.
      // UPR-04: an absent-target update fails as not installed, as uninstall's
      // does.
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── PUP-1 pl@mp: not in state AND not in manifest -> partition='failed' ───────

// UPR-04: `update <plugin>@<mp>` checks the install record before the
// marketplace manifest, as Claude Code does, so a plugin absent from both local
// state AND the manifest fails as `(failed) {not installed}`, the same row a
// plugin the manifest still lists renders.
test("PUP-1 / UPR-04 pl@mp: targeting a plugin not in state AND not in manifest -> partition='failed' (not installed)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-pup1-pl-nomanifest-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // Empty manifest: no entry for "hello", and hello is not installed
        // (no installedVersions). The record check fires first.
        manifestPlugins: {},
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── ATTR-02 missing marketplace -> standalone {marketplace not added} (both forms) ───────

// ATTR-02 / SCOPE-01: `@<mp>` form against an absent marketplace with an
// explicit `--scope` emits the standalone `MarketplaceNotAddedMessage`
// (`{marketplace not added}` on the marketplace subject) carrying the
// requested-scope bracket -- NOT a `(failed) {not found}` synthetic plugin row
// (the M10/M11 misattribution). No raw MarketplaceNotFoundError/Error escapes
// the orchestrator.
test("ATTR-02 @<mp>: unknown marketplace with explicit scope -> standalone {marketplace not added} [scope] bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-attr02-nomp-mp-");
    try {
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // Standalone marketplace-subject row; bracket carries the REQUESTED scope
      // (SCOPE-01); no summary line, no cause-chain trailer.
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [project] (failed) {marketplace not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ATTR-02: `<plugin>@<mp>` form against an absent marketplace with an explicit
// scope converges on the SAME standalone `{marketplace not added}` emission as the `@<mp>`
// form (both flow through enumerateMarketplaceTarget).
test("ATTR-02 <plugin>@<mp>: unknown marketplace with explicit scope -> standalone {marketplace not added} [scope] bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-attr02-nomp-pl-");
    try {
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "user",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [user] (failed) {marketplace not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ATTR-02: bare `@<mp>` form (no `--scope`) against a marketplace absent in BOTH
// scopes -> standalone `{marketplace not added}` with NO `[scope]` bracket (absent-from-both
// form; no requested scope to report).
test("ATTR-02 @<mp> bare: unknown marketplace absent from both scopes -> standalone {marketplace not added}, no bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-attr02-nomp-bare-");
    try {
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        // scope omitted -> bare form searches both scopes, misses both.
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {marketplace not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SCOPE-01: explicit-scope `@<mp>` against a marketplace present ONLY in the
// other scope -> standalone `{marketplace not added}` carrying the REQUESTED scope bracket
// ("not added in the scope you asked for"; the operator infers the other scope).
test("SCOPE-01 @<mp>: marketplace present only in other scope -> scope-qualified not-added row [requestedScope]", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-scope01-other-");
    try {
      // Seed the marketplace in PROJECT (seedPathMarketplace uses project).
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        // Ask for USER explicitly; the marketplace lives only in project.
        scope: "user",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {marketplace not added to user scope}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SCOPE-01: explicit-scope `<plugin>@<mp>` against a marketplace present ONLY in
// the other scope -> the PLUGIN row under the REQUESTED scope bracket, NOT the
// marketplace row the `@<mp>` form emits: the container sits one scope over, so
// nothing is installed at the scope named. The brace joins the cross-scope
// token to `not installed`, naming the scope that HOLDS the container -- always
// the opposite of the bracket.
// The plugin form reaches this via `resolveInstalledPluginTarget` returning the
// explicit scope blindly, then `enumerateMarketplaceTarget` finding
// `mp === undefined` for that scope and raising the signal -- the companion of
// the `@<mp>` form test above (WR-01 gap closure). SEV-04 / UPR-04: an absent
// target means the operation was NOT carried out, so the row is a failure.
test("SCOPE-01 / UPR-04 <plugin>@<mp>: marketplace present only in other scope -> (failed) {not installed, marketplace in project scope}", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-scope01-plugin-other-");
    try {
      // Seed the marketplace in PROJECT; ask for USER explicitly.
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "user", // project has it; user doesn't
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n● mp [user]\n  ⊘ hello (failed) {not installed, marketplace in project scope}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// Covers the resolveInstalledPluginTarget → undefined → ?? resolveInstalledMarketplaceTarget
// fallback in enumerateMarketplaceTarget. With no explicit scope, resolveInstalledPluginTarget
// searches both scopes and finds nothing, so the fallback fires to locate the marketplace scope.
test("PUP-1 / UPR-04 pl@mp: no explicit scope + plugin absent -> marketplace-fallback resolution; partition='failed'", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-pup1-noscope-fallback-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        // No installedVersions: plugin absent from state, triggering the ?? fallback.
      });

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        // scope omitted: resolveInstalledPluginTarget finds nothing → ?? fallback to
        // resolveInstalledMarketplaceTarget which locates the marketplace scope.
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const body = notifications[0]?.message ?? "";
      // V2 byte form mirrors the pl@mp not-installed shape (PUP-1 above).
      // Plugin-row `[<scope>]` bracket suppressed by orphan-fold. UPR-04: an
      // absent-target update fails as not installed.
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {not installed}",
      );
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── syncCloneOnce fetch failure -> notifyError ────────────────────────────────

test("syncClone-fail: gitOps.fetch throws -> notifyError fired and updatePlugins returns early", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-syncfail-");
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("1.0.0"),
            },
          },
        },
      });

      const { ctx, run, notifications } = makeCtx();
      // fetchThrows causes refreshGitHubClone -> gitOps.fetch to throw,
      // which propagates through syncCloneOnce and is caught there.
      const { gitOps } = createGitOps({
        fetchThrows: new Error("network: connection refused"),
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /network/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("syncClone-fail: a non-Error injected rejection is a network error at the direct boundary", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sync-non-error-");
    try {
      // arrange
      await seedGithubMarketplaceForSync(cwd);
      const { gitOps: baseGitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const rejectNonError = Promise.reject.bind(Promise);
      const gitOps: GitOps = {
        ...baseGitOps,
        fetch: () => rejectNonError("transport string rejection"),
      };
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps,
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /\{network error\}/);
      assert.match(notifications[0]?.message ?? "", /transport string rejection/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a non-Error rejection from a target's run is normalized at the direct boundary", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-run-non-error-");
    try {
      // arrange
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const rejectNonError = Promise.reject.bind(Promise);
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        undefined,
        process.env,
        () => rejectNonError("dependency string rejection"),
      );
      const { ctx, run, notifications } = makeCtx();

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        refusedUpdateNotification(
          "hello v1.0.0 → v1.1.0",
          "unreadable manifest",
          "dependency string rejection",
        ),
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { title, makeFailure, reason } of [
  {
    title: "classifies EACCES marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("denied"), { code: "EACCES" }),
    reason: "permission denied",
  },
  {
    title: "classifies EPERM marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("denied"), { code: "EPERM" }),
    reason: "permission denied",
  },
  {
    title: "classifies ENOENT marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("missing"), { code: "ENOENT" }),
    reason: "source missing",
  },
  {
    title: "classifies ENOTDIR marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("missing"), { code: "ENOTDIR" }),
    reason: "source missing",
  },
  {
    title: "classifies EISDIR marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("is a directory"), { code: "EISDIR" }),
    reason: "unreadable",
  },
  {
    title: "classifies EIO marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("input/output error"), { code: "EIO" }),
    reason: "unreadable",
  },
  {
    title: "classifies EBADF marketplace refresh failures",
    makeFailure: () => Object.assign(new Error("bad file descriptor"), { code: "EBADF" }),
    reason: "unreadable",
  },
  {
    title: "classifies stable network errno marketplace refresh failures",
    makeFailure: () =>
      Object.assign(new Error("opaque transport failure"), { code: "ENETUNREACH" }),
    reason: "network unreachable",
  },
  {
    title: "classifies missing marketplace refresh targets",
    makeFailure: () =>
      Object.assign(new MarketplaceNotFoundError("official", ["project"]), {
        message: "opaque typed absence",
      }),
    reason: "not found",
  },
  {
    title: "keeps the primary reason when structured cleanup context is present",
    makeFailure: () =>
      new CleanupContextError(
        Object.assign(new MarketplaceNotFoundError("official", ["project"]), {
          message: "opaque typed absence",
        }),
        [
          {
            phase: "abort",
            artifact: "mcp",
            path: "/scope/mcp.json",
            cause: new Error("cleanup failed"),
          },
        ],
      ),
    reason: "not found",
  },
  {
    title: "classifies rollback marketplace refresh failures",
    makeFailure: () =>
      Object.assign(
        new PluginUpdatePhase3Error("replace failed", [{ phase: "skills", msg: "replace failed" }]),
        { message: "opaque typed phase failure" },
      ),
    reason: "rollback partial",
  },
  {
    title: "classifies concurrently removed marketplace refresh targets",
    makeFailure: () =>
      Object.assign(new PluginUpdateConcurrencyError("marketplace-removed", "hello", "official"), {
        message: "opaque typed concurrency",
      }),
    reason: "concurrently uninstalled",
  },
  {
    title: "classifies concurrently uninstalled marketplace refresh targets",
    makeFailure: () =>
      Object.assign(new PluginUpdateConcurrencyError("plugin-uninstalled", "hello", "official"), {
        message: "opaque typed concurrency",
      }),
    reason: "concurrently uninstalled",
  },
  {
    title: "classifies concurrently updated marketplace refresh targets",
    makeFailure: () =>
      Object.assign(new PluginUpdateConcurrencyError("plugin-updated", "hello", "official"), {
        message: "opaque typed concurrency",
      }),
    reason: "concurrently updated",
  },
  {
    title: "classifies invalid marketplace refresh failures",
    makeFailure: () =>
      Object.assign(new InvalidMarketplaceManifestError("manifest rejected"), {
        message: "opaque typed manifest failure",
      }),
    reason: "invalid manifest",
  },
  {
    title: "classifies an unknown network error without parsing message keywords",
    makeFailure: () =>
      new Error("rollback invalid network concurrently updated at /private/root/token.txt"),
    reason: "network error",
  },
] as const) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-sync-reason-");
      try {
        // arrange
        await seedGithubMarketplaceForSync(cwd);
        const { gitOps } = createGitOps({
          fetchThrows: makeFailure(),
          remoteRefs: {
            "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001",
          },
        });
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "marketplace", marketplace: "official" },
          gitOps,
        });

        // assert
        assert.equal(notifications.length, 1);
        assert.match(notifications[0]?.message ?? "", new RegExp(`\\{${reason}\\}`));
        if (reason === "network error") {
          assert.match(
            notifications[0]?.message ?? "",
            /cause: rollback invalid network concurrently updated at token\.txt/,
          );
          assert.doesNotMatch(notifications[0]?.message ?? "", /\/private\/root/);
        }

        assert.equal(notifications[0]?.severity, "error");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

for (const { title, makeFailure } of [
  {
    title: "D-PL4-09: an occupied agent target fails with no reason, and its cause names the file",
    makeFailure: () => new AgentTargetOccupiedError("/scope/.pi/agents/pi-claude-marketplace-a.md"),
  },
  {
    title: "D-PL4-09: an occupied agent target under cleanup context fails with no reason",
    makeFailure: () =>
      new CleanupContextError(
        new AgentTargetOccupiedError("/scope/.pi/agents/pi-claude-marketplace-a.md"),
        [
          {
            phase: "abort",
            artifact: "mcp",
            path: "/scope/mcp.json",
            cause: new Error("cleanup failed"),
          },
        ],
      ),
  },
] as const) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-agent-target-reason-");
      try {
        // arrange
        await seedGithubMarketplaceForSync(cwd);
        const { gitOps } = createGitOps({
          fetchThrows: makeFailure(),
          remoteRefs: {
            "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001",
          },
        });
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "marketplace", marketplace: "official" },
          gitOps,
        });

        // assert
        assert.equal(notifications.length, 1);
        const message = notifications[0]?.message ?? "";
        assert.match(message, /\(failed\)(?! \{)/);
        assert.doesNotMatch(message, /unreadable manifest/);
        assert.match(
          message,
          /Cannot replace agent target with non-previous content at pi-claude-marketplace-a\.md/,
        );
        assert.equal(notifications[0]?.severity, "error");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

// ─── invalid manifest -> loadMarketplaceManifest throws (covers preflightUpdate
//     path where manifest load fails; the PLUGIN_ENTRY_VALIDATOR.Check
//     is structurally unreachable because MARKETPLACE_VALIDATOR embeds the same
//     PLUGIN_ENTRY_SCHEMA -- the outer check always catches it first) ───────────

test("manifest-load-fail: manifest with invalid entry name type -> notifyError on direct path", async () => {
  // When loadMarketplaceManifest throws (MARKETPLACE_VALIDATOR rejects an
  // entry with name=number), the error propagates out of preflightUpdate
  // and is caught by the direct path's catch -> notifyError.
  // The PLUGIN_ENTRY_VALIDATOR.Check is structurally
  // unreachable: MARKETPLACE_VALIDATOR uses the same PLUGIN_ENTRY_SCHEMA, so
  // any entry that passes MARKETPLACE_VALIDATOR also passes PLUGIN_ENTRY_VALIDATOR.
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-manifest-fail-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Overwrite the manifest with an entry where `name` is a number.
      // MARKETPLACE_VALIDATOR.Check fails -> loadMarketplaceManifest throws.
      // This propagates through preflightUpdate -> runThreePhaseUpdate -> direct
      // path catch -> notifyError.
      await writeFile(
        seeded.manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [{ name: 42, source: "./plugins/hello", version: "1.0.1" }],
        }),
      );

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      // The direct path fires notifyError (not a skipped outcome, because
      // loadMarketplaceManifest threw before PLUGIN_ENTRY_VALIDATOR.Check).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /schema invalid/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── prepareUpdateHandles catch + abortHandles ───────────────────────────────

test("prepare-handles-fail / GLK-02 / D-PL7-12: MCP collision aborts partial handles and fails as unreadable manifest with its cause", async () => {
  // prepareStageMcpServers throws McpServerCollisionError (from
  // assertNoMcpCollisions) with three handles already populated -- skills,
  // commands and agents -- and none for mcp or the workflows prepare that
  // would have run next. abortPartialHandles fires with those three handles.
  // The throw propagates to runThreePhaseUpdate -> updateSinglePlugin cascade
  // catch -> partition='failed'.
  //
  // Setup: seed <cwd>/.pi/mcp-adapter.json with hello's "rollback-server" key
  // (ANAME-01) owned by a DIFFERENT plugin. Then seed hello@mp with version
  // 1.0.1 declaring "rollback-server". discoverGeneratedNames does NOT check
  // MCP collisions (it only discovers skills/commands/agents), so it succeeds.
  // prepareStageMcpServers then reads the scoped mcp-adapter.json, finds the
  // key in `theirs`, and throws McpServerCollisionError.
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-prepare-mcp-fail-");
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasMcp: true },
        },
        installedVersions: { hello: "1.0.0" },
      });
      await writeFile(
        path.join(marketplaceRoot, "plugins", "hello", ".mcp.json"),
        JSON.stringify({
          mcpServers: { "rollback-server": { command: "node", args: ["hello.js"] } },
        }),
      );

      // Pre-populate the project-scope mcp-adapter.json with hello's key owned by
      // another plugin. This puts the key into `theirs` when
      // prepareStageMcpServers calls partitionServers for the update.
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
      await writeFile(
        locations.mcpAdapterJsonPath,
        JSON.stringify({
          mcpServers: {
            "plugin_hello_rollback-server_": {
              command: "node",
              args: ["other.js"],
              _piClaudeMarketplace: { plugin: "other-plugin", marketplace: "mp" },
            },
          },
        }),
      );

      const prevCwd = process.cwd();
      process.chdir(cwd);

      // act
      // Cascade path: updateSinglePlugin must return failed (not throw).
      let outcome: Awaited<ReturnType<typeof updateSinglePlugin>>;
      try {
        outcome = await updateSinglePlugin("hello", "mp", "project");
      } finally {
        process.chdir(prevCwd);
      }

      // assert
      assert.equal(outcome.partition, "failed", `expected failed, got ${outcome.partition}`);
      assert.equal(outcome.name, "hello");
      assert.deepEqual(outcome.reasons, ["unreadable manifest"]);
      assert.ok(outcome.partition === "failed");
      // D-PL7-12: the fallback reason carries the collision as its cause.
      assert.ok(outcome.cause instanceof McpServerCollisionError);
      assert.deepStrictEqual(
        [outcome.cause.serverName, outcome.cause.owningPath],
        ["plugin_hello_rollback-server_", locations.mcpAdapterJsonPath],
      );
      assert.ok((outcome.notes ?? []).length > 0, "failed outcome must carry error notes");
      for (const stagingRoot of [
        locations.skillsStagingDir,
        locations.commandsStagingDir,
        locations.agentsStagingDir,
      ]) {
        if (await pathExists(stagingRoot)) {
          assert.deepStrictEqual(await readdir(stagingRoot), []);
        }
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── bare form: enumerates both user and project scopes ───────────────────────

test("bare-form both-scopes: changed plugins render marketplace groups in presentation order", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-bare-both-");
    try {
      // Seed project scope with plugin alpha.
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-proj"),
        marketplaceName: "mp-proj",
        manifestPlugins: { alpha: { version: "1.0.1", hasSkill: true } },
        installedVersions: { alpha: "1.0.0" },
      });

      // Seed user scope (HOME-based) with plugin beta.
      // locationsFor("user", ...) uses HOME to find the Pi agent dir.
      const userLocations = locationsFor("user", cwd);
      await mkdir(userLocations.extensionRoot, { recursive: true });
      const userMarketplaceRoot = path.join(process.env.HOME ?? tmpdir(), "mp-user");
      await mkdir(userMarketplaceRoot, { recursive: true });
      await mkdir(path.join(userMarketplaceRoot, ".claude-plugin"), { recursive: true });

      const betaPluginRoot = path.join(userMarketplaceRoot, "plugins", "beta");
      await mkdir(betaPluginRoot, { recursive: true });
      await mkdir(path.join(betaPluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(betaPluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "beta", version: "1.0.1" }),
      );
      const betaSkillDir = path.join(betaPluginRoot, "skills", "tool");
      await mkdir(betaSkillDir, { recursive: true });
      await writeFile(path.join(betaSkillDir, "SKILL.md"), "---\nname: tool\n---\nBody.\n");

      const userManifestPath = path.join(userMarketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        userManifestPath,
        JSON.stringify({
          name: "mp-user",
          plugins: [{ name: "beta", source: "./plugins/beta", version: "1.0.1" }],
        }),
      );

      await saveState(userLocations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          "mp-user": {
            name: "mp-user",
            scope: "user",
            source: pathSource("./mp-user"),
            addedFromCwd: cwd,
            manifestPath: userManifestPath,
            marketplaceRoot: userMarketplaceRoot,
            plugins: {
              beta: makePluginRecord("1.0.0"),
            },
          },
        },
      });

      // bare form with no explicit scope -> enumerates both scopes
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        cwd,
        target: { kind: "all" },
        // No scope -> bare form enumerates both user and project scopes
      });

      // assert
      // Both scopes are enumerated and both changed rows survive grouping. Static
      // marketplace presentation is alphabetical; the plugin rows retain their
      // public enumeration order inside each group.
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      const projectIndex = body.indexOf("● mp-proj [project]");
      const userIndex = body.indexOf("● mp-user [user]");
      assert.ok(projectIndex >= 0, body);
      assert.ok(userIndex > projectIndex, body);
      assert.match(body, /Plugin update: 2 updated/);
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── Captured completion-cache ownership and hygiene failure ─────────────────

test("successful update finalizes routes before dropping only its captured cache target", async (testContext) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-captured-cache-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const completionCache = createCompletionCache();
      const peerCache = createCompletionCache();
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const events: string[] = [];
      const rebuildRoutingTables = hooksRouting.rebuildRoutingTables.bind(hooksRouting);
      testContext.mock.method(hooksRouting, "rebuildRoutingTables", () => {
        events.push("routes-finalized");
        rebuildRoutingTables();
      });
      const dropMarketplaceCache = completionCache.dropMarketplaceCache.bind(completionCache);
      const drop = testContext.mock.method(
        completionCache,
        "dropMarketplaceCache",
        async (...args: Parameters<typeof dropMarketplaceCache>) => {
          const [, , marketplace] = args;
          const state = await loadState(locations.extensionRoot);
          events.push(
            `cache-dropped:${state.marketplaces.mp?.plugins.hello?.version ?? "missing"}`,
          );
          assert.strictEqual(marketplace, "mp");
          await dropMarketplaceCache(...args);
        },
      );
      const operations = createPluginUpdateOperations(hooksRouting, completionCache);
      const targetPath = await locations.pluginCacheFile("mp");
      const unrelatedPath = await locations.pluginCacheFile("other");
      const staleTarget = [{ name: "stale-target", status: "available" }] as const;
      const staleUnrelated = [{ name: "stale-unrelated", status: "available" }] as const;
      const stalePeer = [{ name: "stale-peer", status: "available" }] as const;
      await completionCache.getPluginIndex(targetPath, "project", "mp", () =>
        Promise.resolve(staleTarget),
      );
      await rm(targetPath, { force: true });
      await completionCache.getPluginIndex(unrelatedPath, "project", "other", () =>
        Promise.resolve(staleUnrelated),
      );
      await rm(unrelatedPath, { force: true });
      await peerCache.getPluginIndex(targetPath, "project", "mp", () => Promise.resolve(stalePeer));
      await rm(targetPath, { force: true });
      const { ctx, run, notifications } = makeCtx();

      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const freshTarget = [{ name: "fresh-target", status: "available" }] as const;
      const targetRows = await completionCache.getPluginIndex(targetPath, "project", "mp", () =>
        Promise.resolve(freshTarget),
      );
      const unrelatedRows = await completionCache.getPluginIndex(
        unrelatedPath,
        "project",
        "other",
        () => Promise.resolve([{ name: "unexpected-unrelated-rebuild", status: "available" }]),
      );
      const peerRows = await peerCache.getPluginIndex(targetPath, "project", "mp", () =>
        Promise.resolve([{ name: "unexpected-peer-rebuild", status: "available" }]),
      );

      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
      ]);
      assert.strictEqual(
        (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello?.version,
        "1.0.1",
      );
      assert.deepStrictEqual(targetRows, freshTarget);
      assert.deepStrictEqual(unrelatedRows, staleUnrelated);
      assert.deepStrictEqual(peerRows, stalePeer);
      assert.deepStrictEqual(events, ["routes-finalized", "cache-dropped:1.0.1"]);
      assert.strictEqual(drop.mock.callCount(), 1);
      assert.deepStrictEqual(drop.mock.calls[0]?.arguments, [targetPath, "project", "mp"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("dropCache-fail: captured cache failure stays silent after successful update", async () => {
  // After a successful 3-phase update, dropPluginCompletionCache calls
  // dropMarketplaceCache which calls unlink(pluginCachePath). If the path is
  // a DIRECTORY, unlink throws EISDIR (not ENOENT), which is re-thrown by
  // dropMarketplaceCache. The catch block in dropPluginCompletionCache keeps
  // this post-commit hygiene failure silent without changing the outcome.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-dropcache-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the plugin cache path as a DIRECTORY so that
      // unlink(pluginCachePath) throws EISDIR instead of succeeding.
      const cacheFile = await locations.pluginCacheFile("mp");
      await mkdir(cacheFile, { recursive: true });

      const { ctx, run, notifications } = makeCtx();
      const completionCache = createCompletionCache();
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
      ]);
      assert.strictEqual(
        (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello?.version,
        "1.0.1",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── swapStateRecord: marketplace removed between sync and preflight ───────────

test("CR-01: a later marketplace removed during an earlier refresh aborts before its own sync and still reports the earlier target", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-later-marketplace-gone-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const aaaClone = await locations.sourceCloneDir("aaa");
      const zzzClone = await locations.sourceCloneDir("zzz");
      await cp(fixtureMarketplaceDir("valid-marketplace"), aaaClone, { recursive: true });
      await cp(fixtureMarketplaceDir("valid-marketplace"), zzzClone, { recursive: true });
      const marketplaceRecord = (name: string, cloneDir: string) => ({
        name,
        scope: "project" as const,
        source: githubSource("https://github.com/test/repo#main"),
        addedFromCwd: cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: { hello: makePluginRecord("1.0.0") },
      });
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          aaa: marketplaceRecord("aaa", aaaClone),
          zzz: marketplaceRecord("zzz", zzzClone),
        },
      });
      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps: GitOps = {
        ...gitOps,
        fetch: async (options) => {
          await originalFetch(options);
          const state = await loadState(locations.extensionRoot);
          delete state.marketplaces["zzz"];
          await saveState(locations.extensionRoot, state);
        },
      };
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "all" },
        gitOps: mutatingGitOps,
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● zzz [project]\n" +
            "  ⊘ zzz (failed) {not found}\n" +
            '    cause: Marketplace "zzz" not found in project scope.\n\n' +
            "Plugin update: 1 failure",
          severity: "error",
        },
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● aaa [project]\n" +
            "  ⊘ hello v1.0.0 (failed) {source missing}\n\n" +
            "Plugin update: 1 failure",
          severity: "error",
        },
      ]);
      assert.equal((await loadState(locations.extensionRoot)).marketplaces["zzz"], undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("swapState-mp-gone: marketplace removed via gitOps.fetch side-effect -> graceful skipped outcome", async () => {
  // Uses a github-source marketplace with a custom gitOps. The gitOps.fetch
  // synchronously writes a modified state.json that removes the marketplace
  // entry. The modification happens INSIDE syncCloneOnce's github-source
  // branch (after syncCloneOnce's loadState found the marketplace) but is
  // written to disk, so subsequent loadState calls (preflightUpdate and
  // withStateGuard) read the modified state.
  //
  // preflightUpdate reads the now-modified state where the marketplace is
  // absent -> returns partition='skipped' (notes: marketplace not found).
  // No unhandled throw; no error notification.
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-swap-mp-gone-");
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Synchronously remove the marketplace from state.json so that
          // subsequent loadState calls (preflightUpdate) find no marketplace.
          writeFileSync(stateJsonPath, JSON.stringify({ schemaVersion: 1, marketplaces: {} }));
        },
      };

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // assert
      // enumerateTargets ran with original state (hello in official).
      // syncCloneOnce ran, modified state.json to remove official.
      // preflightUpdate reads modified state -> marketplace not found ->
      // returns skipped. The notification reflects a skipped outcome.
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, "no error notification expected");
      const body = notifications[0]?.message ?? "";
      assert.match(body, /skipped/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── swapStateRecord: plugin concurrently uninstalled ──────────────────────────

test("swapState-plugin-gone: plugin removed from state between enumerateTargets and preflight -> error (not installed)", async () => {
  // gitOps.fetch removes the plugin record from state.json after
  // enumerateTargets has already collected "hello" as a target. When
  // preflightUpdate runs, loadState finds no "hello" in the marketplace
  // plugins -> returns partition='failed' (notes: "not installed"), the
  // absent-target failure (UPR-04).
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-swap-plugin-gone-");
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Remove only the "hello" plugin record, keep marketplace intact.
          writeFileSync(
            stateJsonPath,
            JSON.stringify({
              schemaVersion: 1,
              marketplaces: {
                official: {
                  name: "official",
                  scope: "project",
                  source: { kind: "github", raw: "https://github.com/test/repo#main" },
                  addedFromCwd: cwd,
                  manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
                  marketplaceRoot: cloneDir,
                  plugins: {},
                },
              },
            }),
          );
        },
      };

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // preflightUpdate reads modified state -> "hello" not in plugins ->
      // returns failed (not installed), an error row (UPR-04).
      assert.ok(notifications.length >= 1, "expected at least one notification");
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 1, "absent-target update is an error (UPR-04)");
      const body = notifications[0]?.message ?? "";
      assert.match(body, /\(failed\) \{not installed\}/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── concurrent version bump via gitOps.fetch side-effect ─────────────────────

test("swapState-version-advanced: version advanced during fetch -> update runs against newer fromVersion", async () => {
  // gitOps.fetch advances hello's version from 0.0.9 to 0.0.10 in state.json.
  // preflightUpdate reads 0.0.10 as fromVersion. The manifest fixture has
  // hello at 1.0.0, which is different -> preflight returns PluginPreflight.
  // withStateGuard then reads state (still 0.0.10) and the guard
  // fromVersion==0.0.10 matches state.version==0.0.10 -> no ST-9 error.
  // The update proceeds successfully.
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-swap-ver-advanced-");
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const cloneDir = await locations.sourceCloneDir("official");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
      await mkdir(path.join(cloneDir, "plugins", "hello"), { recursive: true });

      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          official: {
            name: "official",
            scope: "project",
            source: githubSource("https://github.com/test/repo#main"),
            addedFromCwd: cwd,
            manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: cloneDir,
            plugins: {
              hello: makePluginRecord("0.0.9"),
            },
          },
        },
      });

      const stateJsonPath = locations.stateJsonPath;

      const { gitOps } = createGitOps({
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const originalFetch = gitOps.fetch.bind(gitOps);
      const mutatingGitOps = {
        ...gitOps,
        fetch: async (opts: Parameters<typeof gitOps.fetch>[0]): Promise<void> => {
          await originalFetch(opts);
          // Advance hello's version to 0.0.10.
          writeFileSync(
            stateJsonPath,
            JSON.stringify({
              schemaVersion: 1,
              marketplaces: {
                official: {
                  name: "official",
                  scope: "project",
                  source: { kind: "github", raw: "https://github.com/test/repo#main" },
                  addedFromCwd: cwd,
                  manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
                  marketplaceRoot: cloneDir,
                  plugins: { hello: makePluginRecord("0.0.10") },
                },
              },
            }),
          );
        },
      };

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "official" },
        gitOps: mutatingGitOps,
      });

      // assert
      // No error: version advanced from 0.0.9 to 0.0.10, manifest has 1.0.0.
      // preflightUpdate uses 0.0.10 as fromVersion; withStateGuard finds 0.0.10
      // -> they match -> update proceeds.
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● official [project]\n  ● hello v0.0.10 → v1.0.0 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── phase 3a commands commit failure ──────────────────────────────────────────

test("phase3a-commands-fail: command target occupied by directory -> phase3aFailures includes commands", async () => {
  // commitPreparedCommands calls rename(stagedFile.md, targetFile.md).
  // On Linux, rename(regular_file, existing_directory) fails with EISDIR.
  // Pre-creating the command target path as a DIRECTORY forces this error.
  // This exercises runThreePhaseUpdate's phase 3a aggregation.
  //
  // We also pre-create the skills target as a FILE (as in the PUP-6 test) to
  // force skills commit failure too, ensuring the phase3aFailures array has
  // multiple entries and the recovery hint includes the command failure.
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-phase3a-cmd-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasCommand: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Obstacle 1: pre-create skills target as a FILE so commitPreparedSkills throws.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      // Obstacle 2: pre-create the command target path as a DIRECTORY so
      // commitPreparedCommands rename(file -> dir) fails with EISDIR.
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await mkdir(path.join(locations.promptsTargetDir, "hello:deploy.md"), { recursive: true });

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      // Both skills and commands commit should fail; the aggregate recovery
      // hint should appear in the notifications.
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(
        allText,
        /Run \/claude:plugin reinstall hello@mp to repair it\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint somewhere in:\n${allText}`,
      );

      // TR-04 SC#1/SC#2 post-state: skills + commands FAILED;
      // agents + mcp SUCCEEDED (seed declares no entries for those
      // bridges so each writes an empty `recorded[]` array via the
      // !failedPhases.has(bridge) gate). Version stays at fromVersion;
      // intent-mark survives; failed bridges' resources stay at
      // pre-update value; succeeded bridges still hit the per-bridge
      // write path.
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      // Failed bridges retain pre-update resources; succeeded bridges write
      // empty arrays (seed declares no entries for agents/mcp).
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── phase 3a agents commit failure ──────────────────────────────────────────

test("phase3a-agents-fail: a read-only agents directory -> commitPreparedAgents throws", async () => {
  // commitPreparedAgents calls rename(stagedFile.md, targetFile.md) for each
  // agent. A read-only agents directory makes that rename fail with EACCES
  // after the swap's pre-intent target check found the target free. This
  // exercises runThreePhaseUpdate's phase 3a aggregation.
  //
  // Also pre-create the skills obstacle so the test also verifies that
  // phase 3a continues across multiple bridge failures (D-03 discipline).
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-phase3a-agents-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-create the skills target as a FILE to force skills commit failure.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      // Make the agents directory read-only to force the agents commit's
      // rename to fail.
      await mkdir(locations.agentsDir, { recursive: true });
      await chmod(locations.agentsDir, 0o500);

      const { ctx, run, notifications } = makeCtx();

      // act
      try {
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });
      } finally {
        await chmod(locations.agentsDir, 0o700);
      }

      // assert
      // Both skills and agents commit should fail; recovery hint appears.
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(
        allText,
        /Run \/claude:plugin reinstall hello@mp to repair it\./,
        `expected RECOVERY_PLUGIN_REINSTALL_PREFIX hint somewhere in:\n${allText}`,
      );

      // TR-04 SC#1/SC#2 post-state: skills + agents FAILED;
      // commands + mcp SUCCEEDED (seed declares no entries for commands
      // or mcp so each writes an empty `recorded[]` via the
      // !failedPhases.has(bridge) gate). Version unchanged; intent-mark
      // survives; resources untouched for failed bridges; empty for
      // succeeded bridges (byte-identical to pre-update but exercises
      // the per-bridge orthogonality gate).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      // Failed bridges retain pre-update skills; agents failed too (no entry
      // in seed so previously [] and stays []); commands/mcp succeeded with
      // empty recorded[].
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── TR-04 matrix coverage (SC#4) ─────────────────────────────────
// Per-bridge orthogonality: finalizeUpdateRecord gates each bridge's resource
// write on !failedPhases.has(bridge), INDEPENDENT of other bridges' outcomes.
// The 4 dedicated "exactly one bridge fails" tests below + the all-success
// WR-04 + existing PUP-6 (skills-only-fail) + phase3a-commands-fail
// (skills+commands fail) + phase3a-agents-fail (skills+agents fail) cover
// every per-bridge "succeed" vs "fail" outcome in both directions for all
// four bridges. The remaining 9 multi-failure cases compose deterministically.

test("TR-04 matrix: skills-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tr04-skills-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Force skills commit failure only (PUP-6 shape).
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /Run \/claude:plugin reinstall hello@mp to repair it\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // Version + intent-mark stay at pre-update / in-progress on failure.
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      // Failed bridge: skills resources stay at pre-update value.
      assert.deepEqual([...rec.resources.skills], ["seeded-skill"]);
      // Succeeded bridges: resources updated to new generated names.
      assert.deepEqual([...rec.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...rec.resources.agents], ["pi-claude-marketplace-hello-bot"]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-04 matrix: commands-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tr04-commands-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Force commands commit failure only (DIR at target path -> EISDIR).
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await mkdir(path.join(locations.promptsTargetDir, "hello:deploy.md"), {
        recursive: true,
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /Run \/claude:plugin reinstall hello@mp to repair it\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], ["pi-claude-marketplace-hello-bot"]);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-04 matrix: agents-fails-others-succeed", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tr04-agents-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Force agents commit failure only (read-only agents directory -> the
      // rename fails with EACCES).
      await mkdir(locations.agentsDir, { recursive: true });
      await chmod(locations.agentsDir, 0o500);

      const { ctx, run, notifications } = makeCtx();
      try {
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });
      } finally {
        await chmod(locations.agentsDir, 0o700);
      }

      assert.equal(notifications.length, 1);
      const allText = notifications[0]?.message ?? "";
      assert.match(allText, /Run \/claude:plugin reinstall hello@mp to repair it\./);

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0");
      assert.equal(rec.compatibility.installable, false);
      assert.ok(rec.compatibility.notes.includes("update-in-progress"));
      assert.deepEqual([...rec.resources.skills], ["hello-tool"]);
      assert.deepEqual([...rec.resources.prompts], ["hello:deploy"]);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], ["server1"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// TR-04 matrix #4 (mcp-fails-others-succeed) NOTE:
//
// A dedicated "mcp commit fails, others succeed" test is OMITTED
// because the mcp bridge's prepare step (`prepareStageMcpServers`) reads
// `locations.mcpAdapterJsonPath` via `readMcpConfigDoc` BEFORE the bridge commit
// runs (stage.ts:178). The only file-system obstacle that reliably forces
// a commit-time failure for atomicWriteJson (a DIRECTORY at the target
// path) ALSO trips the prepare-step `readFile` with EISDIR, surfacing as
// a phase-2-or-earlier throw (`(failed) {unreadable manifest}`) BEFORE
// any state mutation. Phase-2 throws are routed through `notifyDirectFailure`
// in updatePlugins's outer catch (update.ts:332), so finalize never runs
// and the per-bridge orthogonality gate is never exercised for the mcp
// axis.
//
// Per-bridge orthogonality coverage for mcp is structurally identical to
// the other three bridges in `finalizeUpdateRecord` (the gate is literally
// `if (!failedPhases.has("mcp"))` and writes
// `sRecord.resources.mcpServers = handles.mcp.result.recorded.map(...)`,
// the same shape as the other three). The all-success WR-04 test verifies
// the !failedPhases.has("mcp") => write path; the three other matrix tests
// (skills / commands / agents fail) each demonstrate that an UNRELATED
// bridge's failure does NOT block mcp's resources write. The full mcp
// gate-blocked variant would need a test seam injecting a mid-flight
// failure between mcp's prepare and commit.

test("TR-04 retry: partial-success-state-converges-to-new-version", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tr04-retry-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Call 1: seed the PUP-6 skills obstacle so phase-3a fails on
      // skills only. Intent-mark survives, version stays at 1.0.0,
      // resources.skills stays at pre-update empty.
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "hello-tool"), "obstacle");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const call1Text = notifications[0]?.message ?? "";
      assert.match(call1Text, /Run \/claude:plugin reinstall hello@mp to repair it\./);

      // Intermediate post-state assertion: partial-success state.
      const mid = await loadState(locations.extensionRoot);
      const midRec = mid.marketplaces["mp"]?.plugins["hello"];
      assert.ok(midRec !== undefined);
      assert.equal(midRec.version, "1.0.0");
      assert.equal(midRec.compatibility.installable, false);
      assert.ok(midRec.compatibility.notes.includes("update-in-progress"));
      // Failed skills bridge: pre-update value retained.
      assert.deepEqual([...midRec.resources.skills], ["seeded-skill"]);

      // Between calls: clear the obstacle so the second commit's rename
      // can succeed cleanly.
      await rm(path.join(locations.skillsTargetDir, "hello-tool"), { force: true });

      // Call 2: fresh notification recorder so we assert only the
      // second run's notifications.
      const { ctx: ctx2, run: run2, notifications: notifications2 } = makeCtx();
      await updatePlugins({
        ctx: ctx2,
        run: run2,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // SC#5 / NFR-3: the second run must NOT emit any error notifications.
      const errs2 = notifications2.filter((n) => n.severity === "error");
      assert.equal(
        errs2.length,
        0,
        `second run must NOT emit errors; got: ${JSON.stringify(errs2)}`,
      );

      // Final post-state: convergence to all-success contract.
      const final = await loadState(locations.extensionRoot);
      const rec2 = final.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec2 !== undefined);
      assert.equal(rec2.version, "1.0.1");
      assert.equal(rec2.compatibility.installable, true);
      assert.ok(
        !rec2.compatibility.notes.includes("update-in-progress"),
        "intent-mark must NOT survive a successful retry",
      );
      assert.deepEqual([...rec2.resources.skills], ["hello-tool"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-05: an up-to-date named update leaves the base layer unchanged", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-uptodate-layer-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.baseConfigJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      const bytesBefore = await readFile(locations.baseConfigJsonPath);

      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const bytesAfter = await readFile(locations.baseConfigJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Seed `hello` 1.0.0 installed in the project scope with 1.0.1 offered, and
 * write each given layer's bytes; a layer without bytes stays absent.
 */
async function seedLayeredUpdate(
  cwd: string,
  layers: { readonly base?: string; readonly local?: string },
  offeredVersion = "1.0.1",
): Promise<ReturnType<typeof locationsFor>> {
  const locations = locationsFor("project", cwd);
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: offeredVersion, hasSkill: true } },
    installedVersions: { hello: "1.0.0" },
  });
  if (layers.base !== undefined) {
    await writeFile(locations.baseConfigJsonPath, layers.base, "utf8");
  }

  if (layers.local !== undefined) {
    await writeFile(locations.localConfigJsonPath, layers.local, "utf8");
  }

  return locations;
}

/** The bytes of both layer configs and of `state.json`, with the state mtime. */
async function updateFileSnapshot(locations: ReturnType<typeof locationsFor>): Promise<{
  readonly base: string | undefined;
  readonly local: string | undefined;
  readonly state: string;
  readonly stateMtimeMs: number;
}> {
  const readIfPresent = async (filePath: string): Promise<string | undefined> =>
    (await pathExists(filePath)) ? readFile(filePath, "utf8") : undefined;
  return {
    base: await readIfPresent(locations.baseConfigJsonPath),
    local: await readIfPresent(locations.localConfigJsonPath),
    state: await readFile(locations.stateJsonPath, "utf8"),
    stateMtimeMs: (await stat(locations.stateJsonPath)).mtimeMs,
  };
}

/** The single failed-row notification a refused named update of `plugin` renders. */
function refusedUpdateNotification(
  subject: string,
  reason: string,
  cause: string,
): { readonly message: string; readonly severity: "error" } {
  return {
    message: [
      "A plugin operation has failed.",
      "",
      "● mp [project]",
      `  ⊘ ${subject} (failed) {${reason}}`,
      `    cause: ${cause}`,
    ].join("\n"),
    severity: "error",
  };
}

const HELLO_DECLARED = JSON.stringify({ schemaVersion: 1, plugins: { "hello@mp": {} } });

for (const { direction, layers, local, reason, cause } of [
  {
    direction: "without --local a plugin only the local layer declares",
    layers: { local: HELLO_DECLARED },
    local: false,
    reason: "plugin in local layer only",
    cause:
      "The plugin hello@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
  },
  {
    direction: "with --local a plugin only the base layer declares",
    layers: { base: HELLO_DECLARED },
    local: true,
    reason: "plugin in base layer only",
    cause:
      "The plugin hello@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
  },
] as const) {
  test(`LAYER-04: a named update ${direction} is refused and changes nothing`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-layer-refusal-");
      try {
        // arrange
        const locations = await seedLayeredUpdate(cwd, layers);
        const filesBefore = await updateFileSnapshot(locations);
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          local,
        });

        // assert
        assert.deepEqual(notifications, [refusedUpdateNotification("hello", reason, cause)]);
        assert.deepEqual(await updateFileSnapshot(locations), filesBefore);
        assert.equal(await recordedHelloVersion(locations), "1.0.0");
        assert.equal(await pathExists(locations.skillsTargetDir), false);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

async function recordedHelloVersion(
  locations: ReturnType<typeof locationsFor>,
): Promise<string | undefined> {
  return (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello?.version;
}

interface LayerConfig {
  readonly bytes: string;
  readonly mtimeMs: number;
}

async function readLayerConfig(filePath: string): Promise<LayerConfig | undefined> {
  return (await pathExists(filePath))
    ? { bytes: await readFile(filePath, "utf8"), mtimeMs: (await stat(filePath)).mtimeMs }
    : undefined;
}

/** The bytes and mtime of each layer config; an absent file reads as undefined. */
async function layerConfigs(locations: ReturnType<typeof locationsFor>): Promise<{
  readonly base: LayerConfig | undefined;
  readonly local: LayerConfig | undefined;
}> {
  return {
    base: await readLayerConfig(locations.baseConfigJsonPath),
    local: await readLayerConfig(locations.localConfigJsonPath),
  };
}

test("LAYER-04: a changed named update of a plugin the base layer declares leaves both layer configs unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-declared-layers-");
    try {
      // arrange
      const locations = await seedLayeredUpdate(cwd, {
        base: JSON.stringify({ schemaVersion: 1, plugins: { "hello@mp": { futureKey: "x" } } }),
        local: JSON.stringify({ schemaVersion: 1, plugins: { "other@mp": {} } }),
      });
      const layersBefore = await layerConfigs(locations);
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(await recordedHelloVersion(locations), "1.0.1");
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-08: a named update of a dependency updates it and writes no layer config", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-dependency-");
    try {
      // arrange
      const locations = await seedLayeredUpdate(cwd, {});
      const seededState = await loadState(locations.extensionRoot);
      const seededRecord = seededState.marketplaces.mp?.plugins.hello;
      assert.ok(seededRecord !== undefined);
      seededRecord.provenance = "dependency";
      await saveState(locations.extensionRoot, seededState);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(await recordedHelloVersion(locations), "1.0.1");
      assert.deepEqual(await layerConfigs(locations), { base: undefined, local: undefined });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Seed `hello` and `other` 1.0.0 installed in the project scope with 1.0.1
 * offered, and write `localBytes` into the local layer.
 */
async function seedTwoPluginUpdate(
  cwd: string,
  localBytes: string,
): Promise<ReturnType<typeof locationsFor>> {
  const locations = locationsFor("project", cwd);
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: {
      hello: { version: "1.0.1", hasSkill: true },
      other: { version: "1.0.1", hasSkill: true },
    },
    installedVersions: { hello: "1.0.0", other: "1.0.0" },
  });
  await writeFile(locations.localConfigJsonPath, localBytes, "utf8");
  return locations;
}

async function recordedVersions(
  locations: ReturnType<typeof locationsFor>,
): Promise<Record<string, string | undefined>> {
  const plugins = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins;
  return { hello: plugins?.hello?.version, other: plugins?.other?.version };
}

test("LAYER-04: a bare update writes no layer config for any record", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-bare-no-layer-");
    try {
      // arrange
      const locations = await seedTwoPluginUpdate(cwd, HELLO_DECLARED);
      const layersBefore = await layerConfigs(locations);
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({ ctx, run, scope: "project", cwd, target: { kind: "all" } });

      // assert
      assert.deepEqual(await recordedVersions(locations), { hello: "1.0.1", other: "1.0.1" });
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { form, target } of [
  { form: "bare", target: { kind: "all" } },
  { form: "@marketplace", target: { kind: "marketplace", marketplace: "mp" } },
] as const) {
  test(`LAYER-04: the ${form} update with --local updates only the plugins the local layer declares`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-nameless-local-");
      try {
        // arrange
        const locations = await seedTwoPluginUpdate(cwd, HELLO_DECLARED);
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({ ctx, run, scope: "project", cwd, target, local: true });

        // assert
        assert.deepEqual(await recordedVersions(locations), { hello: "1.0.1", other: "1.0.0" });
        assert.deepEqual(notifications, [
          {
            message:
              "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes",
          },
        ]);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });

  test(`LAYER-04: the ${form} update without --local updates every installed plugin of the scope`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-nameless-flagless-");
      try {
        // arrange
        const locations = await seedTwoPluginUpdate(cwd, HELLO_DECLARED);
        const { ctx, run } = makeCtx();

        // act
        await updatePlugins({ ctx, run, scope: "project", cwd, target });

        // assert
        assert.deepEqual(await recordedVersions(locations), { hello: "1.0.1", other: "1.0.1" });
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

for (const { form, target, rowName, blockName } of [
  { form: "bare", target: { kind: "all" }, rowName: "(update)", blockName: "(update)" },
  {
    form: "@marketplace",
    target: { kind: "marketplace", marketplace: "mp" },
    rowName: "(mp)",
    blockName: "mp",
  },
] as const) {
  test(`CFG-03: the ${form} update with --local fails naming an unreadable local layer and touches no plugin`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-nameless-local-invalid-");
      try {
        // arrange
        const locations = await seedTwoPluginUpdate(cwd, "{ not json");
        const filesBefore = await updateFileSnapshot(locations);
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({ ctx, run, scope: "project", cwd, target, local: true });

        // assert
        assert.deepEqual(notifications, [
          {
            message: [
              "A plugin operation has failed.",
              "",
              `● ${blockName} [project]`,
              `  ⊘ ${rowName} (failed) {invalid manifest}`,
              '    cause: Config file "claude-plugins.local.json" failed schema validation.',
              "",
              "Plugin update: 1 failure",
            ].join("\n"),
            severity: "error",
          },
        ]);
        assert.deepEqual(await updateFileSnapshot(locations), filesBefore);
        assert.deepEqual(await recordedVersions(locations), { hello: "1.0.0", other: "1.0.0" });
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

/**
 * Install `hello`, `other`, and `gone` from marketplace `mp` in the project
 * scope, with `gone` no longer in the marketplace, and declare `hello` and
 * `gone` in the local layer.
 */
async function seedUnreadableLocalDeclaration(
  cwd: string,
): Promise<ReturnType<typeof locationsFor>> {
  const locations = locationsFor("project", cwd);
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: {
      hello: { version: "1.0.1", hasSkill: true },
      other: { version: "1.0.1", hasSkill: true },
    },
    installedVersions: { hello: "1.0.0", other: "1.0.0", gone: "1.0.0" },
  });
  await writeFile(
    locations.localConfigJsonPath,
    JSON.stringify({ schemaVersion: 1, plugins: { "hello@mp": {}, "gone@mp": {} } }),
    "utf8",
  );
  return locations;
}

for (const { form, target, rowName, blockName } of [
  { form: "bare", target: { kind: "all" }, rowName: "(update)", blockName: "(update)" },
  {
    form: "@marketplace",
    target: { kind: "marketplace", marketplace: "mp" },
    rowName: "(mp)",
    blockName: "mp",
  },
] as const) {
  test(`LAYER-04: the ${form} update with --local fails as unreadable when a local plugin's dependencies cannot be read, and changes nothing`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-nameless-local-unreadable-");
      try {
        // arrange
        const locations = await seedUnreadableLocalDeclaration(cwd);
        const filesBefore = await updateFileSnapshot(locations);
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({ ctx, run, scope: "project", cwd, target, local: true });

        // assert
        assert.deepEqual(notifications, [
          {
            message: [
              "A plugin operation has failed.",
              "",
              `● ${blockName} [project]`,
              `  ⊘ ${rowName} (failed) {unreadable}`,
              "    cause: cannot read the dependencies of gone@mp: not declared by its marketplace, and its installed copy cannot be read",
              "",
              "Plugin update: 1 failure",
            ].join("\n"),
            severity: "error",
          },
        ]);
        assert.deepEqual(await updateFileSnapshot(locations), filesBefore);
        assert.deepEqual(await recordedVersions(locations), { hello: "1.0.0", other: "1.0.0" });
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

/**
 * Install `hello` and `gone` from marketplace `mp` in the project scope, with
 * `gone` no longer in the marketplace, so the dependency walk cannot read it.
 */
async function seedUnreadableSiblingRecord(cwd: string): Promise<ReturnType<typeof locationsFor>> {
  const locations = locationsFor("project", cwd);
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
    installedVersions: { hello: "1.0.0", gone: "1.0.0" },
  });
  return locations;
}

test("D-18-17: an update whose dependency walk cannot read another recorded plugin fails as unreadable and names it", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-walk-unreadable-");
    try {
      // arrange
      const locations = await seedUnreadableSiblingRecord(cwd);
      const filesBefore = await updateFileSnapshot(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      // UPR-03: the walk failed after the preflight found the record, so the
      // row shows the installed version it left in place.
      assert.deepStrictEqual(notifications, [
        refusedUpdateNotification(
          "hello v1.0.0",
          "unreadable",
          "cannot read the dependencies of gone@mp: not declared by its marketplace, and its installed copy cannot be read",
        ),
      ]);
      assert.deepStrictEqual(await updateFileSnapshot(locations), filesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-17: an autoupdate cascade fails a plugin whose dependency walk cannot read another record as unreadable", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cascade-walk-unreadable-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const locations = await seedUnreadableSiblingRecord(cwd);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.ok(outcome.partition === "failed");
      const { cause, ...failure } = outcome;
      const walkMessage =
        "cannot read the dependencies of gone@mp: not declared by its marketplace, and its installed copy cannot be read";
      assert.deepStrictEqual(failure, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        notes: [`${walkMessage}\n\ncause: ${walkMessage}`],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["unreadable"],
      });
      assert.ok(cause instanceof DependencyDeclarationsUnreadableError);
      assert.deepStrictEqual([cause.declarer, cause.message], ["gone@mp", walkMessage]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FIX-03: a bare update under a marketplace only the local config declares updates and writes no declaration", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-local-mp-");
    try {
      // arrange
      const localBytes = JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: path.join(cwd, "mp-src") } },
      });
      const locations = await seedLayeredUpdate(cwd, { local: localBytes });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({ ctx, run, scope: "project", cwd, target: { kind: "all" } });

      // assert
      assert.equal(await recordedHelloVersion(locations), "1.0.1");
      assert.equal(await pathExists(locations.baseConfigJsonPath), false);
      assert.equal(await readFile(locations.localConfigJsonPath, "utf8"), localBytes);
      assert.deepEqual(
        notifications.filter((n) => n.message.includes("(failed)")),
        [],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03: a named flagless update whose local layer cannot be read is refused before the preflight", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-local-invalid-");
    try {
      // arrange
      const locations = await seedLayeredUpdate(cwd, { local: "{ not json" });
      const filesBefore = await updateFileSnapshot(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(notifications, [
        refusedUpdateNotification(
          "hello",
          "invalid manifest",
          'Config file "claude-plugins.local.json" failed schema validation.',
        ),
      ]);
      assert.deepEqual(await updateFileSnapshot(locations), filesBefore);
      assert.equal(await recordedHelloVersion(locations), "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function localOnlyMarketplaceBytes(cwd: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    marketplaces: { mp: { source: path.join(cwd, "mp-src") } },
  });
}

test("LAYER-08: a named update of a plugin no layer declares, under a marketplace only the local layer declares, updates it", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-local-mp-named-");
    try {
      // arrange
      const localBytes = localOnlyMarketplaceBytes(cwd);
      const locations = await seedLayeredUpdate(cwd, { local: localBytes });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(await recordedHelloVersion(locations), "1.0.1");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: a named update with --local under a marketplace only the local layer declares updates the plugin and writes no layer config", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-local-mp-flag-");
    try {
      // arrange
      const locations = await seedLayeredUpdate(cwd, { local: localOnlyMarketplaceBytes(cwd) });
      const layersBefore = await layerConfigs(locations);
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        local: true,
      });

      // assert
      assert.equal(await recordedHelloVersion(locations), "1.0.1");
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: an up-to-date named update of a plugin only the local layer declares is refused before the version check", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-local-key-current-");
    try {
      // arrange
      await seedLayeredUpdate(cwd, { local: HELLO_DECLARED }, "1.0.0");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(notifications, [
        refusedUpdateNotification(
          "hello",
          "plugin in local layer only",
          "The plugin hello@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
        ),
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-UPD: update vs disabled plugin ──────────────────────────────────────

test("WR-02 / NFR-3: an already-current disabled record does not take the scope lock", async () => {
  // The disabled record now falls THROUGH the unchanged-version short-circuit
  // so a moved source or a changed compatibility block still refreshes. That
  // put a `retries: 0` lock acquisition on a path that had been lock-free, so a
  // scope where nothing moved started throwing StateLockHeldError under
  // contention -- and the bare-form batch aborts on that throw, taking every
  // target after the disabled plugin with it.
  //
  // The first update settles the record; the second one has nothing to write,
  // so it must complete against a HELD lock.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr02-lockfree-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Pass one: settles resolvedSource and the compatibility block.
      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      await whileStateLockHeld(locations, async () => {
        const { ctx, run, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        // D-99-05a row contract: an unchanged version reports the ARTIFACT
        // state, which genuinely is unchanged. The point of the assertion is
        // the row it is NOT -- the `(failed) {lock held}` the unconditional
        // acquisition produced.
        assert.equal(notifications.length, 1);
        assert.match(notifications[0]!.message, /\(skipped\) \{up-to-date\}/);
        assert.doesNotMatch(notifications[0]!.message, /lock held|\(failed\)/);
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FLR-01: a held scope lock fails an update that is due as lock held and keeps its cause", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-flr01-lock-held-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, run, notifications } = makeCtx();
      await whileStateLockHeld(locations, async () => {
        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });
      });

      // assert: the lock is hit at the intent mark, after the candidate, so
      // the row names the move it attempted (UPR-03).
      assert.deepStrictEqual(notifications, [
        refusedUpdateNotification(
          "hello v1.0.0 → v1.1.0",
          "lock held",
          `Another pi-claude-marketplace operation is in progress for project scope (${locations.stateLockFile}). Retry after it completes. -> Lock file is already being held`,
        ),
      ]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-08 / NFR-3: the lock-free skip survives multi-element compatibility lists", async () => {
  // The WR-02 skip compares a projection of the PERSISTED compatibility block
  // against a projection of a FRESHLY RESOLVED one. `disabledPinProjection`
  // stringifies the `notes` / `supported` / `unsupported` array fields
  // positionally, so the skip holds only while the resolver emits those lists in
  // the same order on every resolution of the same input. That contingency is invisible: if any list
  // ever became set-derived, `readdir`-ordered, or `Promise.all`-ordered, the
  // projections would differ on every run of every disabled plugin, the
  // `retries: 0` lock would be acquired unconditionally again, and the
  // batch-abort regression WR-02 exists to prevent would come back silently.
  //
  // The fixture above cannot see that: its lists are one element long at most,
  // and a one-element list has no order to lose. This one seeds two supported
  // kinds, two unsupported kinds and their notes, so a re-ordering resolver
  // fails HERE -- as a `(failed) {lock held}` row -- instead of in production.
  //
  // Deliberately NOT fixed by sorting inside the projection: a sort would make
  // the test pass while hiding the dependency, and the round trip through
  // state.json is the property that actually has to hold.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr08-order-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true, hasCommand: true } },
      });
      // Declares `themes` AND `monitors` -- two unsupported kinds, each with its
      // own `contains <kind>` note.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.0.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Pass one settles the record with resolver-derived lists, in resolver
      // order. `partial` because a CLEAN disabled record has consented to
      // nothing (WR-01).
      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // Fixture-rot guard: if the seeds stop producing multi-element lists this
      // test silently degrades into a duplicate of the WR-02 one above.
      const settled = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(settled !== undefined);
      assert.ok(
        settled.compatibility.supported.length >= 2,
        `supported must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.supported)}`,
      );
      assert.ok(
        settled.compatibility.unsupported.length >= 2,
        `unsupported must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.unsupported)}`,
      );
      assert.ok(
        settled.compatibility.notes.length >= 2,
        `notes must carry >=2 entries for order to be observable: ${JSON.stringify(settled.compatibility.notes)}`,
      );

      await whileStateLockHeld(locations, async () => {
        const { ctx, run, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          partial: true,
        });

        assert.equal(notifications.length, 1);
        assert.doesNotMatch(
          notifications[0]!.message,
          /lock held|\(failed\)/,
          "the re-derived lists compared equal to the persisted ones, so no lock was needed -- a `lock held` row here means the resolver's emit order stopped being stable across resolutions",
        );
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-UPD: update on a disabled plugin refreshes version pin BUT keeps resources empty (no re-materialization)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-d-upd-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        // No installedVersions -- we override the record below.
      });

      // Overwrite the seeded record with a DISABLED-shaped record:
      // empty resources.* + installable:true (the isRecordedButDisabled marker).
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // D-UPD / WR-02: the rendered status is the inherited `(skipped)` token
      // naming the reason nothing was materialized -- NOT `{up-to-date}`, which
      // would claim the version is settled in the very call that moved it.
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]!.message, /\(skipped\) \{already disabled\}/);

      // State: record's version + resolvedSource refreshed (the next `enable`
      // re-materializes from the now-current pin); resources.* stay empty
      // (the plugin remains disabled).
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "version refreshed to manifest pin");
      // resolvedSource refreshed to the current pluginRoot.
      assert.ok(
        rec.resolvedSource.includes("hello"),
        `resolvedSource refreshed to current pluginRoot: ${rec.resolvedSource}`,
      );
      assert.deepEqual(
        [...rec.resources.skills],
        [],
        "resources.skills stay empty (still disabled)",
      );
      assert.deepEqual([...rec.resources.prompts], []);
      assert.deepEqual([...rec.resources.agents], []);
      assert.deepEqual([...rec.resources.mcpServers], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * DFEN-07 / D-103-10: `defaultEnabled` is third-party content. A plugin author
 * who could flip it in a release and thereby flip every existing user's
 * enablement would make the field a remote switch over code already installed.
 * `update` therefore never re-consults it.
 *
 * The fixture flips the declaration BETWEEN the install and the update because
 * installing and updating against the SAME manifest cannot tell "never re-read
 * the field" apart from "re-read it and got the same answer". Only a flip
 * separates the two.
 *
 * The version bump rides in the SAME rewrite as the control. The marketplace
 * manifest is served from a process-lifetime cache keyed on `(mtimeMs, size)`,
 * so a rewrite the cache declines to notice would leave `update` looking at the
 * OLD entry -- and the enablement assertion below would then pass for the wrong
 * reason, proving nothing. The plugin's own `plugin.json` carries no version
 * here, so `entry.version` is what reaches the record: a version that moved is
 * proof the flipped manifest was read.
 */
test("DFEN-07 / D-103-10: update against a flipped defaultEnabled moves the version, not the enablement", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-dfen07-flip-");
    try {
      const locations = locationsFor("project", cwd);
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.2.3",
            hasSkill: true,
            hasCommand: true,
            omitPluginJsonVersion: true,
            entryDefaultEnabled: false,
          },
        },
      });

      // Install for real rather than hand-seeding a disabled record: the DFEN-04
      // record keeps the inventory ENBL-18 preserves, which a hand-seeded
      // disabled record leaves empty.
      const seed = makeCtx();
      const installPlugin = createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      await installPlugin({
        ctx: seed.ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        applyDefaultEnabled: true,
      });

      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(before !== undefined);
      assert.equal(
        before.enabled,
        false,
        "precondition: the entry's declared false reached the DFEN-04 path",
      );
      assert.equal(before.version, "1.2.3");

      // ONE rewrite carrying both halves: the version is the control, the
      // declaration is the subject.
      await rewriteManifest(manifestPath, "mp", {
        hello: { version: "2.0.0", entryDefaultEnabled: true },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const after = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"];
      assert.ok(after !== undefined);
      assert.equal(
        after.version,
        "2.0.0",
        "CONTROL: the version moved, so `update` genuinely re-read the manifest and saw the flipped declaration -- a stale cache would leave it at 1.2.3",
      );
      assert.equal(
        after.enabled,
        false,
        "DFEN-07: the flipped declaration was seen and NOT applied -- a release cannot re-enable a plugin the install recorded disabled",
      );

      // ENBL-09 / WR-02: the truthful row -- the pin moved, nothing was
      // materialized, and the reason token says why.
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]!.message, /\(skipped\) \{already disabled\}/);

      // ENBL-18: a disabled refresh moves the pin, never the inventory. Compared
      // against the pre-update record rather than an assumed empty shape,
      // because a DFEN-04 record carries what the install wrote.
      assert.deepEqual([...after.resources.skills], [...before.resources.skills]);
      assert.deepEqual([...after.resources.prompts], [...before.resources.prompts]);
      assert.deepEqual([...after.resources.agents], [...before.resources.agents]);
      assert.deepEqual([...after.resources.mcpServers], [...before.resources.mcpServers]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * DFEN-08: the overwhelming majority of plugins say nothing about install-time
 * enablement, so what DFEN-08 owes them is that NOTHING moved. The
 * triple is what makes that checkable instead of assumed: `beta` declares the
 * install-time default TRUE, `gamma` declares nothing at all, and the two must
 * render the same row as each other AND as the row this surface produced before
 * the field existed. The declaring sibling is present precisely so the
 * comparison happens inside one live run rather than against a captured
 * baseline that would rot. `alpha`, declaring FALSE, is the third arm: a
 * precedence fixture over a three-valued key that covers two of the values
 * passes while asking the wrong question.
 *
 * Every declaration is flipped between the install and the update, and the
 * version bump rides the SAME rewrite, for the reason the single-plugin case
 * above states: a manifest the `(mtimeMs, size)` cache declined to re-read
 * would leave the verb looking at the OLD entry, and every enablement
 * assertion here would then pass for the wrong reason.
 */
test("DFEN-08: a declared-true entry and a silent entry render identical update rows", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-dfen08-parity-");
    try {
      const locations = locationsFor("project", cwd);
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          alpha: {
            version: "1.0.0",
            hasSkill: true,
            omitPluginJsonVersion: true,
            entryDefaultEnabled: false,
          },
          beta: {
            version: "1.0.0",
            hasSkill: true,
            omitPluginJsonVersion: true,
            entryDefaultEnabled: true,
          },
          // No knob at all: the seeder's conditional spread writes NO
          // `defaultEnabled` key on this entry, which is the arm every plugin
          // that never heard of the field lands on.
          gamma: { version: "1.0.0", hasSkill: true, omitPluginJsonVersion: true },
        },
      });

      // Install all three through the production path, each carrying the
      // install-time opt-in that the real install handler and the reconcile
      // apply pass both set. The whole point is that it changes nothing for two
      // of the three.
      const installPlugin = createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      const install = async (plugin: string): Promise<void> => {
        const seed = makeCtx();
        await installPlugin({
          ctx: seed.ctx,
          run: runWithNothingLoaded(),
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin,
          applyDefaultEnabled: true,
        });
      };

      await install("alpha");
      await install("beta");
      await install("gamma");

      const pluginsNow = async (): Promise<Record<string, PluginRecord>> =>
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {};

      // Precondition: without it the update assertions below can pass over a
      // fixture that never reached the path under test.
      const before = await pluginsNow();
      assert.equal(
        before["alpha"]?.enabled,
        false,
        "precondition: declared false installs disabled",
      );
      assert.equal(before["beta"]?.enabled, true, "precondition: declared true installs enabled");
      assert.equal(before["gamma"]?.enabled, true, "precondition: a silent entry installs enabled");
      assert.equal(before["alpha"]?.version, "1.0.0");
      assert.equal(before["beta"]?.version, "1.0.0");
      assert.equal(before["gamma"]?.version, "1.0.0");

      // ONE rewrite carrying both halves: the version is the CONTROL that
      // proves the manifest was genuinely re-read, the declaration is the
      // subject. Every declaration inverts -- `alpha` to true, `beta` to false,
      // and `gamma` gains the explicit false it never carried.
      await rewriteManifest(manifestPath, "mp", {
        alpha: { version: "2.0.0", entryDefaultEnabled: true },
        beta: { version: "2.0.0", entryDefaultEnabled: false },
        gamma: { version: "2.0.0", entryDefaultEnabled: false },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      // Two benign `updated` rows beside one info-severity skip -> info
      // (severity unset).
      assert.equal(notifications[0]?.severity, undefined);

      // Whole-body rather than per-row `includes`: the literal pins the row
      // ORDER, the tally and the trailer, none of which a substring check
      // constrains. The tally legitimately reads two where a tree without
      // `defaultEnabled` read three -- `alpha` is skipped, so the fixture's own third arm
      // moved the count. That is why the parity claim below is about ROWS.
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ⊘ alpha (skipped) {already disabled}\n" +
          "  ● beta v1.0.0 → v2.0.0 (updated)\n" +
          "  ● gamma v1.0.0 → v2.0.0 (updated)\n" +
          "\n" +
          "Plugin update: 2 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );

      // The parity claim itself, stated apart from the whole-body literal.
      // Before the field was consumed it was an unknown key under the lenient
      // manifest tolerance and therefore inert, so a declared-true entry and a
      // silent entry were LITERALLY the same input -- which is what makes the
      // two literals below the pre-existing row form as well. Asserting the two
      // rendered rows against EACH OTHER catches a drift that two
      // independently-correct literals would both stay green through.
      const rows = body.split("\n");
      const rowFor = (name: string): string =>
        rows.find((line) => line.startsWith(`  ● ${name} `)) ?? "";

      const betaRow = rowFor("beta");
      const gammaRow = rowFor("gamma");
      assert.equal(betaRow, "  ● beta v1.0.0 → v2.0.0 (updated)");
      assert.equal(gammaRow, "  ● gamma v1.0.0 → v2.0.0 (updated)");
      assert.equal(
        betaRow.replaceAll("beta", "<plugin>"),
        gammaRow.replaceAll("gamma", "<plugin>"),
        "DFEN-08: the declared-true row and the silent row must COINCIDE, not merely each match a literal",
      );

      const after = await pluginsNow();
      assert.equal(
        after["alpha"]?.enabled,
        false,
        "DFEN-07: a release flipping the declaration to true cannot re-enable a plugin the install recorded disabled",
      );
      assert.equal(after["beta"]?.enabled, true, "DFEN-08: a flipped declaration moves nothing");
      assert.equal(after["gamma"]?.enabled, true, "DFEN-08: a gained declaration moves nothing");
      // CONTROL: all three versions moved, so the flipped manifest was genuinely
      // re-read. A stale manifest cache would have left every record at 1.0.0
      // and the enablement assertions above would prove nothing.
      assert.equal(after["alpha"]?.version, "2.0.0");
      assert.equal(after["beta"]?.version, "2.0.0");
      assert.equal(after["gamma"]?.version, "2.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── ENBL-09: update vs a DISABLED PARTIAL ──────────────────────────────────
//
// WR-04 / D-98-04: the disabled-record short-circuit is reachable BOTH ways.
// `preflightUpdate` derives the candidate gate's partial argument from the
// record as well as the caller flag, so a disabled record admits a
// partially-available candidate with no flag typed -- `update` is the only
// command that can re-pin such a record, and a disabled record stages nothing.
// The flagged cases below stay valid: `partial: true` remains admissible and
// reaches the same short-circuit. The flagless case is the one that proves
// reachability without the flag.

/** Assert every one of the five resource slots is empty on a disabled record. */
function assertResourcesEmpty(record: PluginRecord, why: string): void {
  assert.deepEqual([...record.resources.skills], [], `skills ${why}`);
  assert.deepEqual([...record.resources.prompts], [], `prompts ${why}`);
  assert.deepEqual([...record.resources.agents], [], `agents ${why}`);
  assert.deepEqual([...record.resources.mcpServers], [], `mcpServers ${why}`);
  assert.deepEqual([...record.resources.hooks], [], `hooks ${why}`);
}

test("WR-04: a targeted update with NO partial flag reaches the disabled-record short-circuit and refreshes the pin", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr04-noflag-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate resolves `partially-available`, which the STRICT gate
      // rejects -- the record's disabled-ness is what widens the gate here.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The re-pin skip row -- NOT the partially-upgradable decline row with its
      // remediation trailer, which is what the strict gate produced before the
      // record-derived widening. WR-02: the reason names why nothing was
      // materialized; `{up-to-date}` would deny the pin move asserted below.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ⊘ hello (skipped) {already disabled}",
      );

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin refreshes without the flag");
      assert.equal(
        rec.compatibility.installable,
        false,
        "availability stays derived from the partially-available resolution",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `unsupported list stays non-empty: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (the refresh stages nothing)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a CLEAN disabled record whose candidate would newly degrade keeps the decline row and its record", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr01-clean-disabled-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate resolves `partially-available`, so admitting it would
      // flip the record's availability discriminant to false.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      // Disabled but CLEAN: the user consented to disabling this plugin, never
      // to degrading it. `makeDisabledPluginRecord` keeps the default
      // `installable: true` compatibility block.
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The XSURF-03 decline row with its remediation trailer -- the consent
      // ask. NOT the `(skipped) {up-to-date}` refresh row, which would rewrite
      // the record with no flag typed and no row naming the new degradation.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (partially-upgradable) {unsupported component}\n    Re-run with --partial to update with the supported components.",
      );
      assert.equal(notifications[0]?.severity, "warning");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.0.0", "the pin does NOT move on a declined update");
      assert.equal(
        rec.compatibility.installable,
        true,
        "availability does NOT flip without an explicit --partial",
      );
      assert.deepEqual([...rec.compatibility.unsupported], [], "no dropped kinds are recorded");
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (nothing was staged)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: an explicit --partial on the same clean disabled record consents to the degrade and re-pins it", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr01-consented-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the flagged path still re-pins the record");
      assert.equal(rec.compatibility.installable, false, "the consented degrade is recorded");
      assert.ok(rec.compatibility.unsupported.length > 0, "the dropped kinds are recorded");
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (a disabled record stages nothing)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: the disabled-record refresh derives compatibility.installable from the resolution -- degraded stays degraded", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-enbl09-degraded-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The candidate still resolves `partially-available`.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // The invariant: the availability discriminant and the unsupported list
      // must agree. `installable: true` beside a non-empty unsupported list is
      // the self-contradictory record ENBL-09 forbids.
      assert.equal(
        rec.compatibility.installable,
        false,
        "availability derived from the partially-available resolution",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `unsupported list stays non-empty: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false, "the record stays disabled");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09 counter-case: a candidate that resolves fully supported promotes the refreshed record's availability", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-enbl09-promoted-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // Same fixture as the degraded case MINUS the unsupported marker, so
        // the candidate resolves `installable`.
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      // Paired with the degraded case above, this proves the value is DERIVED
      // rather than pinned to either constant.
      assert.equal(rec.compatibility.installable, true, "promoted to full availability");
      assert.deepEqual([...rec.compatibility.unsupported], []);
      assert.equal(rec.enabled, false, "promotion of the availability axis never enables");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: update --partial on a disabled PARTIAL refreshes the pin and stages nothing (--partial is required to reach the short-circuit)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-enbl09-shortcircuit-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // Reuses the existing `unchanged` byte form -- the artifact state really
      // IS unchanged, so no new catalog token appears. No `/reload` trailer:
      // nothing was updated.
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" + "  ⊘ hello (skipped) {already disabled}",
      );

      // The defect this guards is re-staging on disk, so assert on disk: the
      // supported `skills/tool` component would materialize as `hello-tool`
      // had the three-phase body run.
      assert.equal(
        await pathExists(path.join(locations.skillsTargetDir, "hello-tool")),
        false,
        "no skill staged for a disabled record",
      );

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "version pin refreshed for a future enable");
      assert.ok(
        rec.resolvedSource.includes("hello"),
        `resolvedSource refreshed to the current pluginRoot: ${rec.resolvedSource}`,
      );
      assert.equal(rec.enabled, false);
      assertResourcesEmpty(rec, "stay empty (no re-materialization)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09: update --partial on a disabled PARTIAL is idempotent -- two identical calls leave the record unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-enbl09-idempotent-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPartialPluginRecord("1.0.0");
      await saveState(locations.extensionRoot, state);

      // Compare on the fields the operation owns; `updatedAt` is a wall-clock
      // stamp and would make the equality flaky.
      const settledFields = async (): Promise<unknown> => {
        const s = await loadState(locations.extensionRoot);
        const r = s.marketplaces["mp"]?.plugins["hello"];
        assert.ok(r !== undefined);
        return {
          version: r.version,
          resolvedSource: r.resolvedSource,
          installable: r.compatibility.installable,
          unsupported: [...r.compatibility.unsupported],
          enabled: r.enabled,
          resources: {
            skills: [...r.resources.skills],
            prompts: [...r.resources.prompts],
            agents: [...r.resources.agents],
            mcpServers: [...r.resources.mcpServers],
            hooks: [...r.resources.hooks],
            workflows: [],
          },
        };
      };

      const runOnce = async (): Promise<NotifyRecord[]> => {
        const { ctx, run, notifications } = makeCtx();
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          partial: true,
        });
        return notifications;
      };

      const firstNotifications = await runOnce();
      const firstRecord = await settledFields();
      // WR-05 / RECON-05: a second identical call must not write state.json at
      // all. The second call DOES reach the refresh -- D-99-05a lets a disabled
      // record past the `toVersion === fromVersion` short-circuit, because its
      // source and compatibility block move independently of the pin. What
      // keeps the record from being rewritten is the refresh's own deep-equal
      // guard: it compares the projection it would write against the persisted
      // one and skips the save when they match.
      // Comparing settled fields alone cannot see a rewrite that lands the same
      // values; the mtime and the wall-clock `updatedAt` can, so read both
      // BEFORE the second call.
      const firstStat = await stat(locations.stateJsonPath);
      const firstUpdatedAt = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ]?.updatedAt;

      const secondNotifications = await runOnce();
      const secondRecord = await settledFields();

      assert.equal(secondNotifications.length, 1);
      // WR-02: the two calls did DIFFERENT things, so their rows differ. The
      // first moved the pin and says so with the skip reason that names why
      // nothing was materialized; the second wrote nothing at all, and
      // `{up-to-date}` is a true statement only there. Both rows are derived
      // from the same version equality, one arm of the refresh each.
      assert.equal(
        firstNotifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {already disabled}",
      );
      assert.equal(
        secondNotifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {up-to-date}",
      );
      assert.deepEqual(secondRecord, firstRecord, "the refresh is a fixed point");

      const secondStat = await stat(locations.stateJsonPath);
      assert.equal(
        secondStat.mtimeMs,
        firstStat.mtimeMs,
        "a no-op refresh must not touch state.json (RECON-05 mtime stability)",
      );
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.updatedAt,
        firstUpdatedAt,
        "a no-op refresh must not bump updatedAt while rendering (skipped) {up-to-date}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-99-05a: a disabled record refreshes under an UNCHANGED version ────────
//
// `refreshDisabledRecord` owns three independently-moving facts: the version
// pin, `resolvedSource`, and the `compatibility` block. Only the first is what
// `toVersion === fromVersion` compares, so a disabled record now falls THROUGH
// that short-circuit and the refresh decides for itself whether anything moved.
//
// The enabled-plugin control for this reordering is the existing PUP-3 case
// above: an enabled record at an equal version still reaches the `unchanged`
// partition with state.json not rewritten. It is asserted there and unedited.

test("D-99-05a: a disabled record whose source moved under an unchanged version is refreshed", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-d9905a-moved-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      // The pin the record carries points somewhere the manifest no longer
      // resolves -- the shape a path-source marketplace re-added from another
      // directory leaves behind. The VERSION is identical to the manifest's, so
      // nothing about the version says the record is stale.
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.1.0");
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // D-99-05a row contract: the artifact state genuinely IS unchanged -- the
      // refresh materializes nothing -- so the byte-pinned up-to-date skip row
      // stays right even though the pin moved. No new catalog state.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(
        rec.resolvedSource,
        path.join(seeded.marketplaceRoot, "plugins", "hello"),
        "a later enable re-materializes from the CURRENT pluginRoot",
      );
      assert.equal(rec.version, "1.1.0", "the version pin was already current");
      assert.equal(rec.enabled, false, "a refresh never enables");
      assertResourcesEmpty(rec, "stay empty (nothing is materialized)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a: a disabled record with nothing to move performs NO write", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-d9905a-noop-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });

      const state = await loadState(locations.extensionRoot);
      state.marketplaces["mp"]!.plugins["hello"] = makeDisabledPluginRecord("1.1.0");
      await saveState(locations.extensionRoot, state);

      // Settle the record first: one update moves the seeded placeholder source
      // onto the current pluginRoot, so the call under test faces a record that
      // already holds exactly what the refresh derives.
      const settling = makeCtx();
      await updatePlugins({
        ctx: settling.ctx,
        run: settling.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const settledBytes = await readFile(locations.stateJsonPath, "utf8");
      const settledStat = await stat(locations.stateJsonPath);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // The write, not the row, discriminates this behavior. The row renders the same bytes whether
      // the refresh no-ops or rewrites the record with identical values, so a
      // row assertion cannot tell a guarded no-op from an unguarded rewrite --
      // which is exactly how the guard came to look like dead code. The bytes
      // catch a rewrite (`updatedAt` would move); the mtime catches even a
      // byte-identical one.
      assert.equal(
        await readFile(locations.stateJsonPath, "utf8"),
        settledBytes,
        "a refresh with nothing to move must leave state.json byte-identical",
      );
      assert.equal(
        (await stat(locations.stateJsonPath)).mtimeMs,
        settledStat.mtimeMs,
        "RECON-05: state.json must not be rewritten at all",
      );
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a: an unsupported kind gained under an unchanged version degrades the refreshed record", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-d9905a-drift-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // The entry gains an unsupported kind at the SAME version -- the
      // compatibility block moves while the pin does not.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const state = await loadState(locations.extensionRoot);
      const record = makeDisabledPluginRecord("1.1.0");
      // Pre-seed the current source so the compatibility block is the ONLY
      // fact that moves.
      record.resolvedSource = path.join(seeded.marketplaceRoot, "plugins", "hello");
      state.marketplaces["mp"]!.plugins["hello"] = record;
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        // WR-01: a CLEAN disabled record has consented to nothing, so its
        // degrade still needs the flag typed.
        partial: true,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin never moved");
      assert.equal(
        rec.compatibility.installable,
        false,
        "a later enable gates on the CURRENT availability discriminant",
      );
      assert.ok(
        rec.compatibility.unsupported.length > 0,
        `the dropped kinds are recorded: ${JSON.stringify(rec.compatibility.unsupported)}`,
      );
      assert.equal(rec.enabled, false);
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-99-05a counter-case: an unsupported kind LOST under an unchanged version promotes the refreshed record", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-d9905a-promote-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
      });
      // No `makeCandidateUnsupported` here: the entry the record remembers as
      // partial now resolves fully supported at the same version.

      const state = await loadState(locations.extensionRoot);
      const record = makeDisabledPartialPluginRecord("1.1.0");
      record.resolvedSource = path.join(seeded.marketplaceRoot, "plugins", "hello");
      state.marketplaces["mp"]!.plugins["hello"] = record;
      await saveState(locations.extensionRoot, state);

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "● mp [project]\n  ⊘ hello (skipped) {up-to-date}");

      // The counter-case half: the degrade above is satisfied by writing a
      // constant `false`, and this one by a constant `true`. Only the pair
      // shows the discriminant is DERIVED from the resolution.
      const after = await loadState(locations.extensionRoot);
      const rec = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(rec !== undefined);
      assert.equal(rec.version, "1.1.0", "the version pin never moved");
      assert.equal(rec.compatibility.installable, true, "availability follows the resolution up");
      assert.deepEqual([...rec.compatibility.unsupported], [], "the stale dropped kind is cleared");
      assert.equal(rec.enabled, false, "promotion of the availability axis never enables");
      assertResourcesEmpty(rec, "stay empty (still disabled)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── CFG-03: an unreadable target layer refuses a named update ─────────────

for (const { layer, layers, local, basename } of [
  {
    layer: "base",
    layers: { base: "{ not json " },
    local: false,
    basename: "claude-plugins.json",
  },
  {
    layer: "local",
    layers: { local: "{ not json " },
    local: true,
    basename: "claude-plugins.local.json",
  },
] as const) {
  test(`CFG-03: a named update whose ${layer} target layer cannot be read is refused naming only ${basename}`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-cfg03-");
      try {
        // arrange
        const locations = await seedLayeredUpdate(cwd, layers, "1.1.0");
        const filesBefore = await updateFileSnapshot(locations);
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
          local,
        });

        // assert
        assert.deepEqual(notifications, [
          refusedUpdateNotification(
            "hello",
            "invalid manifest",
            `Config file "${basename}" failed schema validation.`,
          ),
        ]);
        assert.deepEqual(await updateFileSnapshot(locations), filesBefore);
        assert.equal(await recordedHelloVersion(locations), "1.0.0");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after updatePlugins succeeds, the hooks-bridge routing
// table reflects the NEW (post-update) hooks config. Update does NOT
// delegate to install/uninstall, so the cache lifecycle is wired explicitly
// inside the per-plugin lock and verified end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: one update owner refreshes direct and cascade routes without leaking to a peer runtime", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr03-");
    try {
      const runtime = createHooksRuntime();
      const hooksRouting = createHooksRouting(runtime, { readHooksJson });
      const operations = createPluginUpdateOperations(hooksRouting, createCompletionCache());
      const peerRuntime = createHooksRuntime();
      const locations = locationsFor("user", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };
      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      // Seed marketplace with version A and a state record pre-populated to
      // simulate the post-install state (hooks slug present, cache
      // populated, routing table populated).
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
        scope: "user",
      });

      // Patch the seeded plugin record's `resources.hooks` so the
      // rebuildRoutingTables walk includes it. The default
      // `makePluginRecord` leaves hooks empty.
      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await hooksRouting.readAndCachePluginHooks({
        scope: "user",
        marketplace: "mp",
        plugin: "hello",
        resolvedSource: asAbsolutePluginRoot(pluginRoot),
        hooksJsonPath: path.join(pluginRoot, "hooks", "hooks.json"),
        cwd,
        logPrefix: "update-test",
      });
      hooksRouting.rebuildRoutingTables();
      assert.equal(runtime.getRoutingBucket("PreToolUse")[0]?.handlerDecl["command"], "echo OLD");

      // Rewrite the on-disk plugin tree to v2.0.0 with NEW hooks config.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, run, notifications } = makeCtx();
      await operations.updatePlugins({
        ctx,
        run,
        scope: "user",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean update notification; got: ${summary}`,
      );

      // Post-condition: the routing-table entry reflects the NEW hooks
      // config (command `echo NEW`), not the old one. This proves WR-03's
      // remove+add+rebuild fired after `finalizeUpdateRecord` durably saved
      // the all-success record.
      const postBucket = runtime.getRoutingBucket("PreToolUse");
      assert.equal(postBucket.length, 1);
      assert.equal(postBucket[0]?.pluginId, "hello");
      assert.equal(postBucket[0]?.handlerDecl["command"], "echo NEW");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table after update. CLAUDE_PLUGIN_ROOT export at dispatch depends
      // on it.
      const updateLoc = locationsFor("user", cwd);
      const postState = await loadState(updateLoc.extensionRoot);
      assert.equal(
        postBucket[0]?.resolvedSource,
        postState.marketplaces["mp"]?.plugins["hello"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource after update",
      );

      const cascadeHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo CASCADE" }] }],
      };
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "3.0.0" } });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "3.0.0" }),
      );
      await writeFile(
        path.join(pluginRoot, "hooks", "hooks.json"),
        JSON.stringify(cascadeHooksJson),
      );

      const cascadeOutcome = await operations.beginPluginUpdateRun()("hello", "mp", "user");

      assert.equal(cascadeOutcome.partition, "updated");
      assert.equal(
        runtime.getRoutingBucket("PreToolUse")[0]?.handlerDecl["command"],
        "echo CASCADE",
      );
      assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in update.ts -- Phase 3a commit loop writes /
// removes <hooksDir>/<plugin>/hooks.json between agents and mcp commits.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01 (update): version A->B (both ship hooks) overwrites <hooksDir>/<plugin>/hooks.json atomically with version B's content", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-life01-overwrite-");
    try {
      const locations = locationsFor("project", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };
      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-seed the hooks slug so finalize updates it; the bridge file
      // is not present (the install slot did not exist when this fixture
      // was first written) -- the update commit slot writes it.
      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      // Bump to v2.0.0 with NEW hooks payload on disk.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(
        JSON.parse(written),
        newHooksJson,
        "update Phase 3a commit slot must write version B's hooks.json",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (update): version A (with hooks) -> version B (no hooks) removes the stale hooks file", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-life01-remove-");
    try {
      const locations = locationsFor("project", cwd);

      const oldHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo OLD" }] }],
      };

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true, hooksJson: oldHooksJson },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Pre-place the stale hooks file at the destination so we can assert
      // the update commit removed it.
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify(oldHooksJson),
      );

      const seededState = await loadState(locations.extensionRoot);
      const mpRecord = seededState.marketplaces["mp"];
      assert.ok(mpRecord !== undefined);
      const helloRecord = mpRecord.plugins["hello"];
      assert.ok(helloRecord !== undefined);
      helloRecord.resources.hooks = ["hello"];
      await saveState(locations.extensionRoot, seededState);

      // Bump to v2.0.0 with NO hooks (delete the on-disk hooks tree).
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await rm(path.join(pluginRoot, "hooks"), { recursive: true, force: true });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      // The stale hooks dir must be gone.
      let stillThere = true;
      try {
        await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      } catch {
        stillThere = false;
      }

      assert.equal(
        stillThere,
        false,
        "update Phase 3a commit slot must removeHookConfig when version B has no hooks",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (update): version A (no hooks) -> version B (with hooks) writes the new hooks.json", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-life01-add-");
    try {
      const locations = locationsFor("project", cwd);

      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const newHooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo NEW" }] }],
      };

      // Bump to v2.0.0 WITH a hooks payload.
      await rewriteManifest(seeded.manifestPath, "mp", { hello: { version: "2.0.0" } });
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "2.0.0" }),
      );
      await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
      await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(newHooksJson));

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean update; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(JSON.parse(written), newHooksJson);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── FORCE-02/03/04/05: --partial degrades a partial CANDIDATE ────────────────
//
// D-65-04: `update --partial` is gated on the RESOLVED CANDIDATE (the synced
// clone's current entry), not the installed version. An `experimental
// themes/monitors` declaration on the candidate plugin.json resolves the
// `partially-available` arm (no structural defect) while the supported
// `skills/` component still materializes.

/**
 * Overwrite the candidate plugin.json so the resolver resolves the
 * `partially-available` arm: an `experimental` themes/monitors
 * declaration is an unsupported component kind with no structural defect.
 * The supported `skills/` dir is left intact so the degraded update still
 * materializes the skill.
 */
async function makeCandidateUnsupported(
  marketplaceRoot: string,
  plugin: string,
  version: string,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin,
      version,
      experimental: { themes: "./themes", monitors: "./monitors.json" },
    }),
  );
}

test("FORCE-02: --partial on a candidate that became partially available degrades (skill materializes, version bumps)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-force02-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // The degraded update committed: state reflects the new version and the
      // supported skill materialized; the unsupported kinds are absent.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.1.0");
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      assert.ok(
        (await readFile(skillTarget, "utf8")).length > 0,
        "supported skill must materialize",
      );

      // FSTAT-07 / D-66-04: a `--partial` update whose candidate re-resolved
      // `partially-available` reports `(partially-installed)` with the ◉ glyph +
      // the dropped-component detail (the same derived signal the list deriver
      // reads), not `(updated)`. partially-installed is a realized transition --
      // info severity + reload-hint.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined, "partially-installed is info, not error");
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n" +
          "  ◉ hello v1.0.0 → v1.1.0 (partially-installed) {unsupported component}\n" +
          "\n" +
          "/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-06: an update --partial of a clean record records the degraded plugin as not installable", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-partial-record-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // assert -- the flag install writes for the same resolution, which
      // enable, install and backfill read as the partial-consent marker.
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.deepStrictEqual(record?.compatibility, {
        installable: false,
        notes: ["contains monitors", "contains themes"],
        supported: ["skills"],
        unsupported: ["monitors", "themes"],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("XSURF-03 / FORCE-03: without --partial the partially-upgradable candidate declines `(partially-upgradable)` + the --partial trailer at warning", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-force03-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        // No `--partial` -> the candidate gate stays `requireInstallable`.
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // XSURF-03: the targeted no-`--partial` decline of a partially-upgradable
      // candidate renders the `(partially-upgradable)` token + the update-worded
      // `--partial` trailer; SEV-04 keeps the targeted decline at warning.
      assert.match(body, /\(partially-upgradable\)/);
      assert.match(body, /Re-run with --partial to update with the supported components\./);
      assert.doesNotMatch(body, /\{no longer installable\}/);
      assert.equal(notifications[0]?.severity, "warning");

      // State untouched -- the block left the installed version in place.
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// SEV-04 / D-69-02 / XSURF-03: a BULK (`@marketplace`) update that skips a
// partially-upgradable candidate the user did not target is benign -> info
// (contrast FORCE-03, the TARGETED decline that stays warning). Same
// `(partially-upgradable)` per-row token + `--partial` trailer; only the severity
// (and the summary tally) move. The SEV-04 split is now keyed on the
// partially-upgradable STATUS arm, NOT the reason string -- this pair (warning
// here vs FORCE-03) proves it holds.
test("XSURF-03 / SEV-04: bulk update skipping a partially-upgradable candidate -> info (untargeted decline)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sev04-bulk-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        // Bulk `@mp` form -> cardinality "plural" -> the decline is benign info.
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      // UGRM-01/UGRM-02: full-body lock. A bulk update whose only non-`updated`
      // row is a benign info `(partially-upgradable)` decline (0 updated, 0
      // failures/warnings) renders the cascade BODY (the row +
      // `--partial` trailer) AND the never-silent `Plugin update: nothing to
      // update` headline below it -- the summary line does NOT vanish. The
      // degrade reason `{unsupported component}` is the `makeCandidateUnsupported`
      // (experimental manifest) form sourced through `narrowUnsupportedKinds`
      // (D-90-05: a non-carve-out component kind renders `unsupported component`).
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● hello v1.0.0 (partially-upgradable) {unsupported component}\n" +
          "    Re-run with --partial to update with the supported components.\n" +
          "\n" +
          "Plugin update: nothing to update",
      );
      assert.doesNotMatch(body, /\{no longer installable\}/);
      // SEV-04: a bulk (untargeted) decline is benign -> info (severity unset).
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-04: the partial-degrade update path emits no warning severity and no `Warning:` summary", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-force04-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      const warnings = notifications.filter((n) => n.severity === "warning");
      assert.equal(warnings.length, 0, `unexpected warning rows: ${JSON.stringify(warnings)}`);
      for (const n of notifications) {
        assert.equal(
          n.message.startsWith("Warning:"),
          false,
          `unexpected Warning: summary: ${n.message}`,
        );
      }

      // The success row stays info-level (severity unset == info).
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: --partial cannot bypass an unavailable (non-path source) candidate", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-force05-unavail-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // An npm source resolves `unavailable` (non-path source),
        // which `requirePartialInstallable` still rejects.
        manifestPlugins: {
          hello: {
            version: "1.1.0",
            hasSkill: true,
            rawSourceOverride: { source: "npm", package: "some-pkg" },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      // assert
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /\(skipped\) \{no longer installable\}/);
      assert.equal(notifications[0]?.severity, "warning");
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("FORCE-05: --partial cannot bypass a missing marketplace", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-force05-nomp-");
    try {
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "ghost-mp" },
        partial: true,
      });

      // The missing-marketplace short-circuit fires BEFORE the candidate gate,
      // so `--partial` is inert here.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ ghost-mp [project] (failed) {marketplace not added}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── UGRM-02: tally-override interaction with the warnings + force categories ──

test("UGRM-02 / SEV-01: bulk @mp update of a plugin with an UNLOADED declared companion tallies `1 warning, 1 updated` -> needs attention", async () => {
  // The realized `(updated)` row raises to WARNING because the plugin declares
  // an agents companion (`hasAgent: true`) the probe reports unloaded
  // (`getAllTools() -> []`). The tally-override still counts the realized
  // transition as `1 updated`, AND the warning-severity row counts as `1
  // warning` in the INDEPENDENT warnings category -> `1 warning, 1 updated`.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tally-warn-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasAgent: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Default makeCtx probe (`getAllTools() -> []`) reports pi-subagents
      // UNLOADED, so the declared-agents companion is absent -> the success row
      // raises to warning (SEV-01).
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      const body = notifications[0]?.message ?? "";
      // Warning envelope -> the degraded summary line prepends `needs attention`.
      assert.match(body, /A plugin operation needs attention\./);
      // Tally: the warnings category (row severity) AND the updated override
      // (realized transition) both count the single row.
      assert.match(body, /Plugin update: 1 warning, 1 updated/);
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UGRM-02 / FSTAT-07: bulk @mp --partial counts a partially-installed degrade as a realized transition -> `2 updated`, no `nothing to update` headline", async () => {
  // One clean bump + one degrading candidate. Both land in partition `updated`
  // (the partially-installed arm is emitted from the `updated` case), so the
  // realized-transition count is 2. The never-silent `nothing to update`
  // headline must be ABSENT -- a partially-installed degrade IS a realized update.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-tally-partial-2updated-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // clean: bumps cleanly (installable candidate).
          clean: { version: "1.0.1", hasSkill: true },
          // degrade: candidate re-resolves `partially-available` -> `--partial`
          // degrade-updates it (partially-installed), still a realized transition.
          degrade: { version: "1.1.0", hasSkill: true },
        },
        installedVersions: { clean: "1.0.0", degrade: "1.0.0" },
      });
      await makeCandidateUnsupported(seeded.marketplaceRoot, "degrade", "1.1.0");

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        partial: true,
      });

      const body = notifications[0]?.message ?? "";
      // Both partitions are `updated` -> the tally counts 2 realized transitions.
      assert.match(body, /Plugin update: 2 updated/);
      // A partially-installed degrade is a realized update, so the no-op headline
      // must NOT fire.
      assert.doesNotMatch(body, /nothing to update/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PURL-06 / D-78-05 / D-78-01 -- git-source (url / git-subdir / github) update:
// pin re-resolution, materialize-before-swap, GC-after-swap. update.ts is
// gitOps-exempt (it imports GitOps for marketplace sync) so it may resolveRemoteRef
// for unpinned entries and materialize the new clone inline. The mock gitOps
// copies a real plugin fixture tree into the clone staging dir; the seam renames
// it into plugin-clones/<key>/ and the resolver reads it exactly as a path source.
//
// The MARKETPLACE source stays path (so syncCloneOnce is a NFR-5 no-op); only the
// PLUGIN entry is git-source. The recorded resolvedSha drives the swap-or-not
// decision: manifest sha (pinned) or re-resolved HEAD (unpinned) != recorded ->
// swap; equal -> (unchanged). The old clone is GC'd after the swap iff no
// surviving record references it (D-78-01 derive-not-persist).
// ───────────────────────────────────────────────────────────────────────────

const SHA_OLD = "1111111111111111111111111111111111111111";
const SHA_NEW = "2222222222222222222222222222222222222222";

/**
 * Bind the clone-cache seam entrypoints to a mock gitOps so update's git-source
 * path materializes without touching the network. Mirrors the direct clone
 * seam owned by install-clone-probe.test.ts.
 */
function seamWith(gitOps: GitOps): UpdateCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
    materializePluginCommitCopy: (args) => materializeCommitCopyWith(gitOps, args),
  };
}

/**
 * Build a plugin fixture tree on disk (the "repo" the mock clone copies) whose
 * plugin.json version encodes `versionTag` so successive fixtures are
 * distinguishable, seed a PATH-source marketplace whose manifest entry carries a
 * git-object source, and (optionally) an installed state record pinned at
 * `recordedSha` whose resolvedSource points at the corresponding warm clone.
 */
async function seedGitPluginMarketplace(opts: {
  cwd: string;
  cloneUrl: string;
  fixtureRepoDir: string;
  versionTag: string;
  /** Manifest entry source (pinned carries `sha`; unpinned omits it). */
  entrySource: unknown;
  /** When set, seed an installed record pinned at this sha (git-source). */
  recordedSha?: string;
  /** Extra installed git plugins (name -> recordedSha + entrySource) sharing the mp. */
  extraPlugins?: Record<string, { entrySource: unknown; recordedSha: string }>;
}): Promise<{ marketplaceRoot: string; manifestPath: string; oldCloneRoot?: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const pluginName = "gp";

  // The plugin tree the mock clone copies into staging.
  await mkdir(path.join(opts.fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(opts.fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: opts.versionTag }),
  );
  const skillDir = path.join(opts.fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: greet\n---\n\nHello ${opts.versionTag}.\n`,
  );

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const entries: { name: string; source: unknown }[] = [
    { name: pluginName, source: opts.entrySource },
  ];
  for (const [name, spec] of Object.entries(opts.extraPlugins ?? {})) {
    entries.push({ name, source: spec.entrySource });
  }

  await writeFile(manifestPath, JSON.stringify({ name: "mp", plugins: entries }));

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const plugins: Record<string, PluginRecord> = {};

  const seedGitRecord = async (name: string, sha: string): Promise<string> => {
    // Materialize the warm clone for the recorded sha so a warm-cache update
    // does NOT re-clone, and so the on-disk clone dir exists for the GC
    // assertions. Uses a gitOps that resolves the recorded sha at checkout.
    const key = pluginCloneKey(opts.cloneUrl, sha);
    const cloneRoot = await locations.pluginCloneDir(key);
    // Copy the fixture tree into the clone root directly (warm cache seed).
    await mkdir(path.dirname(cloneRoot), { recursive: true });
    await cp(opts.fixtureRepoDir, cloneRoot, { recursive: true });
    // VER-01: a record made by an install of the fixture tree, which
    // declares `versionTag`.
    const record = makePluginRecord(opts.versionTag);
    plugins[name] = {
      ...record,
      resolvedSource: cloneRoot,
      resolvedSha: sha,
    };
    return cloneRoot;
  };

  let oldCloneRoot: string | undefined;
  if (opts.recordedSha !== undefined) {
    oldCloneRoot = await seedGitRecord(pluginName, opts.recordedSha);
  }

  for (const [name, spec] of Object.entries(opts.extraPlugins ?? {})) {
    await seedGitRecord(name, spec.recordedSha);
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins,
      },
    },
  });

  return oldCloneRoot === undefined
    ? { marketplaceRoot, manifestPath }
    : { marketplaceRoot, manifestPath, oldCloneRoot };
}

test("PURL-06 / D-78-05 pinned sha-change: manifest sha differs from recorded -> swap; resolvedSha updated at the same declared version, old clone GC'd, new clone present", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-git-pinned-swap-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      // The manifest's .git suffix survives onto the wire URL (source.raw)
      // while the parse-time identity (source.url) drops it, so this fixture
      // also discriminates networkCloneUrl from canonicalCloneUrl.
      const rawUrl = "https://example.com/org/repo.git";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      // Installed at SHA_OLD; manifest now carries SHA_NEW (a pinned bump).
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: rawUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps, state: gitState } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "a state record must survive the swap");
      assert.equal(record.resolvedSha, SHA_NEW, "resolvedSha swaps to the new manifest sha");
      // D-16-09: the commit moved, so it is an update at the same declared version.
      assert.equal(record.version, "9.9.9", "VER-01: version is the declared version");

      const newCloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      assert.equal(record.resolvedSource, newCloneRoot, "resolvedSource points at the new clone");
      assert.match(
        path.basename(record.resolvedSource),
        /^[0-9a-f]{12}-[0-9a-f]{12}$/,
        "pinned key stays <12hex>-<12hex> (per-sha, unchanged)",
      );
      assert.equal(await pathExists(newCloneRoot), true, "new clone materialized on disk");
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        false,
        "old clone GC'd (no surviving record references it)",
      );
      assert.equal(
        gitState.cloneCalls[0]?.url,
        rawUrl,
        "the wire url preserves the manifest's .git decision (source.raw)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const GP_DECLARED = JSON.stringify({ schemaVersion: 1, plugins: { "gp@mp": {} } });

for (const { direction, file, local, reason, cause } of [
  {
    direction: "without --local a plugin only the local layer declares",
    file: "localConfigJsonPath",
    local: false,
    reason: "plugin in local layer only",
    cause:
      "The plugin gp@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
  },
  {
    direction: "with --local a plugin only the base layer declares",
    file: "baseConfigJsonPath",
    local: true,
    reason: "plugin in base layer only",
    cause:
      "The plugin gp@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
  },
] as const) {
  test(`NFR-5: a refused named git-source update ${direction} builds no credentials and clones, fetches, and lists nothing`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-layer-refusal-git-");
      try {
        // arrange
        const cloneUrl = "https://example.com/org/repo";
        const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
        await seedGitPluginMarketplace({
          cwd,
          cloneUrl,
          fixtureRepoDir,
          versionTag: "9.9.9",
          entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
          recordedSha: SHA_OLD,
        });
        const locations = locationsFor("project", cwd);
        await writeFile(locations[file], GP_DECLARED, "utf8");
        const stateBytes = await readFile(locations.stateJsonPath, "utf8");
        const { gitOps, state: gitState } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
        const credentials = createCredentialOpsFake({ boundary: "memory" });
        const { ctx, run, notifications } = makeCtx();

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
          local,
          gitOps,
          credentialOps: credentials.credentialOps,
          cloneCacheSeam: seamWith(gitOps),
        });

        // assert
        assert.deepEqual(notifications, [refusedUpdateNotification("gp", reason, cause)]);
        assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
        assert.equal(
          await pathExists(await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW))),
          false,
        );
        assert.deepEqual(
          {
            clone: gitState.cloneCalls,
            fetch: gitState.fetchCalls,
            resolveRemoteRef: gitState.resolveRemoteRefCalls,
            credentials: credentials.calls,
          },
          {
            clone: [],
            fetch: [],
            resolveRemoteRef: [],
            credentials: { fill: [], approve: [], reject: [] },
          },
        );
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("a post-commit clone cleanup failure preserves the successful update", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-clone-gc-fail-");
    let oldCloneRoot: string | undefined;
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      oldCloneRoot = seeded.oldCloneRoot;
      assert.ok(oldCloneRoot !== undefined);
      const locations = locationsFor("project", cwd);
      const stateWatch = observeStateTransition(
        (state) => state.marketplaces["mp"]?.plugins["gp"]?.resolvedSha === SHA_NEW,
        () => {
          chmodSync(locations.pluginClonesDir, 0o000);
        },
      );
      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { ctx, run, notifications } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      await chmod(locations.pluginClonesDir, 0o700);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW);
      // The package step cannot list the new plugin root under the unreadable
      // clones dir either, and reports that in a warning of its own (D-PL9-07).
      assert.equal(notifications.length, 2);
      assert.equal(notifications[1]?.severity, "warning");
      assert.equal(await pathExists(oldCloneRoot), true);
    } finally {
      const locations = locationsFor("project", cwd);
      await chmod(locations.pluginClonesDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-06 / D-78-05 pinned unchanged: manifest sha equals recorded -> outcome (unchanged), no swap, clone dirs untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-pinned-unchanged-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Manifest sha EQUALS the recorded sha.
        entrySource: { source: "url", url: cloneUrl, sha: SHA_OLD },
        recordedSha: SHA_OLD,
      });

      const { gitOps, state: gitState } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_OLD, "recorded sha unchanged");
      assert.equal(record?.version, "9.9.9", "version unchanged");
      // The warm-cache clone was never re-cloned, and the (unchanged) short-
      // circuit did not GC the still-referenced clone.
      assert.equal(gitState.cloneCalls.length, 0, "no clone on an equal-sha (unchanged) update");
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        true,
        "the still-referenced clone survives an unchanged update",
      );
      const body = notifications[0]?.message ?? "";
      assert.match(
        body,
        /\(skipped\) \{up-to-date\}|nothing to update/,
        "renders the up-to-date form",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ENBL-09 / PURL-09: refreshing a DISABLED git-source record moves resolvedSha with its version", async () => {
  // A refresh that moves the commit without `resolvedSha` leaves the record
  // naming the new tree while `reinstall` still pins its re-clone to the OLD
  // commit -- a silent revert of the update. The two fields must agree after
  // the refresh.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-disabled-refresh-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Recorded at SHA_OLD; the manifest now pins SHA_NEW.
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const locations = locationsFor("project", cwd);
      const seededState = await loadState(locations.extensionRoot);
      const seededRecord = seededState.marketplaces["mp"]?.plugins["gp"];
      assert.ok(seededRecord !== undefined);
      // Disable the record in place: the ENBL-02 marker plus the emptied
      // resource slots a real disable leaves behind.
      seededState.marketplaces["mp"]!.plugins["gp"] = {
        ...seededRecord,
        enabled: false,
        resources: {
          skills: [],
          prompts: [],
          agents: [],
          mcpServers: [],
          hooks: [],
          workflows: [],
        },
      };
      await saveState(locations.extensionRoot, seededState);

      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined);
      // D-16-09: the commit moved, so it is an update at the same declared version.
      assert.equal(record.version, "9.9.9", "VER-01: version is the declared version");
      assert.equal(record.resolvedSha, SHA_NEW, "the pin moves with the sha-derived version");
      assert.deepEqual(
        { version: record.version, resolvedSha: record.resolvedSha },
        { version: "9.9.9", resolvedSha: SHA_NEW },
        "version and resolvedSha must describe the SAME commit after the refresh",
      );
      // The refresh never re-materializes: the record stays disabled and empty.
      assert.equal(record.enabled, false, "the record stays disabled");
      assertResourcesEmpty(record, "stay empty (no re-materialization)");
      // PURL-06 / D-78-01: the refresh re-pointed resolvedSource + resolvedSha
      // at the clone the preflight materialized, so the OLD key is
      // unreferenced. This arm returns before the finalize path's
      // GC-after-swap, so the sweep has to run on the arm itself -- otherwise
      // every repeated update of a disabled git-source plugin accumulates one
      // more orphan until an unrelated command happens to sweep.
      const cloneEntries = (await readdir(locations.pluginClonesDir)).sort();
      assert.deepEqual(
        cloneEntries,
        [pluginCloneKey(cloneUrl, SHA_NEW)],
        "plugin-clones/ holds only the live key after the disabled-record refresh",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-10-18: the run-scoped tag memos `updatePluginsWith` and
// `createPluginUpdateOperations` allocate once and thread into every
// target's constraint-gate evaluation, so a repository or marketplace clone
// shared by several constrained targets is listed once per run.
//
// The git arm's tag listing (`platform/git.ts::listRemoteTags`) reaches the
// network through `isomorphic-git`'s own `http` transport object, not
// through the `GitOps` seam `cloneCacheSeam` fakes -- the CLONE step and the
// TAG-LISTING step are two separate git surfaces. `installTagListingTransport`
// below is a trimmed copy of `test/platform/git.test.ts`'s own protocol v2
// wire fixture (info/refs GET negotiation, then a `git-upload-pack` POST
// answering the ls-refs `command=ls-refs` request), pared down to what
// listing a fixed tag set needs -- request counting, not response-body
// assertions, which `test/platform/git.test.ts` already owns.
// ───────────────────────────────────────────────────────────────────────────

function tagListingPacket(payload: string): Buffer {
  const body = Buffer.from(payload, "utf8");
  return Buffer.concat([
    Buffer.from((body.length + 4).toString(16).padStart(4, "0"), "utf8"),
    body,
  ]);
}

const TAG_LISTING_FLUSH = Buffer.from("0000", "utf8");

function tagListingAdvertisementBody(): Buffer {
  return Buffer.concat([
    tagListingPacket("# service=git-upload-pack\n"),
    TAG_LISTING_FLUSH,
    tagListingPacket("version 2\n"),
    tagListingPacket("ls-refs\n"),
    tagListingPacket("fetch\n"),
    TAG_LISTING_FLUSH,
  ]);
}

function tagListingRefsBody(refs: readonly string[]): Buffer {
  return Buffer.concat([...refs.map((ref) => tagListingPacket(`${ref}\n`)), TAG_LISTING_FLUSH]);
}

function tagListingHttpResponse(
  url: string,
  statusCode: number,
  contentType: string,
  bytes: Buffer,
): GitHttpResponse {
  async function* body(): AsyncIterableIterator<Uint8Array> {
    await Promise.resolve();
    yield Uint8Array.from(bytes);
  }

  return {
    url,
    statusCode,
    statusMessage: statusCode === 200 ? "OK" : "Error",
    headers: { "content-type": contentType },
    body: body(),
  };
}

/**
 * Installs a minimal git protocol v2 tag-listing transport for one remote
 * URL, answering every `info/refs` negotiation and `git-upload-pack` ls-refs
 * POST with the SAME fixed `refs` set, and counting the negotiations (one
 * per `listRemoteTags` call) so a test can assert how many times the
 * repository was actually queried. `options.failFirstInfoRefs` makes the
 * FIRST `info/refs` negotiation answer 503 (proving a failed listing writes
 * no memo entry, per D-10-18) before every later one succeeds.
 */
function installTagListingTransport(
  t: TestContext,
  remoteUrl: string,
  refs: readonly string[],
  options: { readonly failFirstInfoRefs?: boolean } = {},
): { readonly infoRefsCalls: number[] } {
  const calls: number[] = [];
  const infoUrl = `${remoteUrl}/info/refs?service=git-upload-pack`;

  t.mock.method(http, "request", (request: GitHttpRequest): Promise<GitHttpResponse> => {
    if (request.url === infoUrl && request.method === "GET") {
      calls.push(calls.length + 1);
      if (options.failFirstInfoRefs === true && calls.length === 1) {
        return Promise.resolve(
          tagListingHttpResponse(request.url, 503, "text/plain", Buffer.alloc(0)),
        );
      }

      return Promise.resolve(
        tagListingHttpResponse(
          request.url,
          200,
          "application/x-git-upload-pack-advertisement",
          tagListingAdvertisementBody(),
        ),
      );
    }

    if (request.url === `${remoteUrl}/git-upload-pack` && request.method === "POST") {
      return Promise.resolve(
        tagListingHttpResponse(
          request.url,
          200,
          "application/x-git-upload-pack-result",
          tagListingRefsBody(refs),
        ),
      );
    }

    throw new Error(`unplanned Git HTTP request: ${request.method ?? "undefined"} ${request.url}`);
  });

  return { infoRefsCalls: calls };
}

/**
 * Seeds a path-source marketplace "mp" declaring one dependent ("app",
 * itself unconstrained) and two git-backed plugins from the SAME repository
 * URL, each constrained by "app"'s own declared range. Both git plugins
 * resolve through `seamWith(gitOps)`'s clone fake -- entirely separate from
 * the tag-listing transport, which `installTagListingTransport` owns.
 */
async function seedConstrainedGitSiblings(
  cwd: string,
  cloneUrl: string,
  fixtureRepoDir: string,
): Promise<void> {
  await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "placeholder", version: "1.2.0" }),
  );
  const skillDir = path.join(fixtureRepoDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: greet\n---\n\nHello.\n");

  const marketplaceRoot = path.join(cwd, "mp-src");
  const appRoot = path.join(marketplaceRoot, "plugins", "app");
  await mkdir(path.join(appRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(appRoot, ".claude-plugin", "plugin.json"),
    // D-01-32: "app"'s own manifest is readable, so it outranks the
    // marketplace entry's `dependencies` field -- the declaration has to
    // live HERE for the constraint walk to see it.
    JSON.stringify({
      name: "app",
      version: "1.0.0",
      dependencies: [
        { name: "gitfoo", version: "^1.0.0" },
        { name: "gitbar", version: "^1.0.0" },
      ],
    }),
  );

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "app", source: "./plugins/app" },
        { name: "gitfoo", source: { source: "url", url: cloneUrl } },
        { name: "gitbar", source: { source: "url", url: cloneUrl } },
      ],
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          app: makePluginRecord("1.0.0"),
          gitfoo: makePluginRecord("0.9.0"),
          gitbar: makePluginRecord("0.9.0"),
        },
      },
    },
  });
}

test("D-10-18: one bulk run lists the same repository's tags once", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-memo-git-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedConstrainedGitSiblings(cwd, cloneUrl, fixtureRepoDir);
      const { infoRefsCalls } = installTagListingTransport(t, cloneUrl, [
        `${SHA_OLD} refs/tags/gitfoo--v1.2.0`,
        `${SHA_NEW} refs/tags/gitbar--v1.2.0`,
      ]);
      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert -- both gitfoo and gitbar are constrained by "app" and share
      // one repository URL; the SAME memo across the whole bulk run means
      // the second plugin's probe reuses the first's listing.
      assert.strictEqual(infoRefsCalls.length, 1);
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.strictEqual(after.marketplaces.mp?.plugins.gitfoo?.resolvedSha, SHA_OLD);
      assert.strictEqual(after.marketplaces.mp?.plugins.gitbar?.resolvedSha, SHA_NEW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-18: one bulk run resolves two path-source siblings from the same marketplace clone", async () => {
  // arrange -- `isomorphic-git`'s own package exports are non-configurable
  // (`t.mock.method` on it throws `Cannot redefine property`, unlike the
  // mutable `isomorphic-git/http/node` transport object the git-arm cases
  // above intercept), so a local `listTags` call count is not observable
  // from this orchestration layer. What IS observable, and asserted below,
  // is that BOTH path-source siblings correctly pin against the SAME
  // marketplace clone's tags in one bulk run -- the memo's own "list once"
  // behavior is already unit-tested directly against the local probe
  // (`marketplace-tag-probe.test.ts`) and against the gate's own threading
  // (`update-constraint-gate.test.ts`'s "D-10-18: one bulk run lists the
  // same marketplace clone's tags once").
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-memo-path-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      const appRoot = path.join(marketplaceRoot, "plugins", "app");
      const pathfooRoot = path.join(marketplaceRoot, "plugins", "pathfoo");
      const pathbarRoot = path.join(marketplaceRoot, "plugins", "pathbar");
      for (const [root, name, deps] of [
        [
          appRoot,
          "app",
          [
            { name: "pathfoo", version: "^1.0.0" },
            { name: "pathbar", version: "^1.0.0" },
          ],
        ],
        [pathfooRoot, "pathfoo", undefined],
        [pathbarRoot, "pathbar", undefined],
      ] as const) {
        await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
        await writeFile(
          path.join(root, ".claude-plugin", "plugin.json"),
          JSON.stringify({
            name,
            version: "1.0.0",
            ...(deps !== undefined && { dependencies: deps }),
          }),
        );
      }

      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await mkdir(path.dirname(manifestPath), { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "app", source: "./plugins/app" },
            { name: "pathfoo", source: "./plugins/pathfoo" },
            { name: "pathbar", source: "./plugins/pathbar" },
          ],
        }),
      );

      // A real (initially tag-less) git repository, matching what a
      // marketplace root actually is in production.
      await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
      await git.add({ fs, dir: marketplaceRoot, filepath: "." });
      const oid = await git.commit({
        fs,
        dir: marketplaceRoot,
        message: "seed marketplace",
        author: { name: "test", email: "test@example.com" },
      });
      await git.tag({ fs, dir: marketplaceRoot, ref: "pathfoo--v1.2.0", object: oid });
      await git.tag({ fs, dir: marketplaceRoot, ref: "pathbar--v1.2.0", object: oid });

      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: {
              app: makePluginRecord("1.0.0"),
              pathfoo: makePluginRecord("0.9.0"),
              pathbar: makePluginRecord("0.9.0"),
            },
          },
        },
      });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      // GV-01: each records its declared 1.0.0 with the tag's commit, and the
      // tag's semver apart.
      const after = await loadState(locations.extensionRoot);
      const pinned = (["pathfoo", "pathbar"] as const).map((name) => {
        const record = after.marketplaces.mp?.plugins[name];
        return [record?.version, record?.resolvedVersion, record?.resolvedSha];
      });
      const expected = [`1.0.0-${oid.slice(0, 12)}`, "1.2.0", oid];
      assert.deepStrictEqual(pinned, [expected, expected]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-18: a failed listing is re-queried for the next plugin in the same run", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-memo-retry-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedConstrainedGitSiblings(cwd, cloneUrl, fixtureRepoDir);
      const { infoRefsCalls } = installTagListingTransport(
        t,
        cloneUrl,
        [`${SHA_OLD} refs/tags/gitfoo--v1.2.0`, `${SHA_NEW} refs/tags/gitbar--v1.2.0`],
        { failFirstInfoRefs: true },
      );
      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert -- the failed attempt wrote no memo entry, so the SECOND
      // plugin re-queries and succeeds instead of inheriting the failure.
      assert.strictEqual(infoRefsCalls.length, 2);
      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.strictEqual(after.marketplaces.mp?.plugins.gitfoo?.version, "0.9.0");
      assert.strictEqual(after.marketplaces.mp?.plugins.gitfoo?.resolvedSha, undefined);
      assert.strictEqual(after.marketplaces.mp?.plugins.gitbar?.resolvedSha, SHA_NEW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-18: two updatePlugins runs through one binding do not share a memo", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-memo-fresh-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedConstrainedGitSiblings(cwd, cloneUrl, fixtureRepoDir);
      const { infoRefsCalls } = installTagListingTransport(t, cloneUrl, [
        `${SHA_OLD} refs/tags/gitfoo--v1.2.0`,
        `${SHA_NEW} refs/tags/gitbar--v1.2.0`,
      ]);
      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();
      // ONE binding for both runs, the shape production has: the binding
      // lives for the whole extension load while each command is its own run.
      const operations = createUpdateOperations();

      // act -- two SEPARATE single-plugin runs.
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gitfoo", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gitbar", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert -- `updatePluginsWith` allocates the memo pair per call, so
      // gitbar's probe re-queries instead of reading gitfoo's listing.
      assert.strictEqual(infoRefsCalls.length, 2);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Seeds a path-source marketplace "mp" whose dependent "app" holds
 * "pathfoo" to `^1.0.0`, in a real git repository carrying no release tag
 * yet. Returns the commit a later `pathfoo--v<version>` tag can name.
 */
async function seedConstrainedPathTarget(
  cwd: string,
  installedVersion = "0.9.0",
): Promise<{ readonly marketplaceRoot: string; readonly oid: string }> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  for (const [name, dependencies] of [
    ["app", [{ name: "pathfoo", version: "^1.0.0" }]],
    ["pathfoo", undefined],
  ] as const) {
    const root = path.join(marketplaceRoot, "plugins", name);
    await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name,
        version: "1.0.0",
        ...(dependencies !== undefined && { dependencies }),
      }),
    );
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "app", source: "./plugins/app" },
        { name: "pathfoo", source: "./plugins/pathfoo" },
      ],
    }),
  );

  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  await git.add({ fs, dir: marketplaceRoot, filepath: "." });
  const oid = await git.commit({
    fs,
    dir: marketplaceRoot,
    message: "seed marketplace",
    author: { name: "test", email: "test@example.com" },
  });

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          app: makePluginRecord("1.0.0"),
          pathfoo: {
            ...makePluginRecord(installedVersion),
            resolvedSource: path.join(marketplaceRoot, "plugins", "pathfoo"),
          },
        },
      },
    },
  });
  return { marketplaceRoot, oid };
}

test("D-10-13: an up-to-date constrained plugin discloses the range that admits it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-ceiling-"));
    try {
      // arrange -- "app" holds "pathfoo" to ^1.0.0, the marketplace clone
      // carries no release tag, and the record already sits at the version
      // the current copy resolves to.
      await seedConstrainedPathTarget(cwd, "1.0.0");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "pathfoo", marketplace: "mp" },
      });

      // assert -- no tag search established a ceiling here, so the cause
      // line names the range and its holder without claiming the version is
      // the highest one admitted.
      assert.deepStrictEqual(notifications, [
        {
          message: [
            "● mp [project]",
            "  ⊘ pathfoo (skipped) {up-to-date}",
            '    cause: constrained to the combined range (^1.0.0) -- required by "app@mp"',
          ].join("\n"),
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-18: a tag published between two cascade runs is visible to the second", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-constraint-memo-lifetime-"));
    const previousCwd = process.cwd();
    try {
      // arrange -- the cascade seam reads `process.cwd()`, and the
      // marketplace clone carries no satisfying tag for "pathfoo" yet.
      const { marketplaceRoot, oid } = await seedConstrainedPathTarget(cwd);
      const locations = locationsFor("project", cwd);
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      process.chdir(cwd);

      // act -- two cascade runs through ONE binding, with the release tag
      // published between them.
      await operations.beginPluginUpdateRun()("pathfoo", "mp", "project");
      await git.tag({ fs, dir: marketplaceRoot, ref: "pathfoo--v1.2.0", object: oid });
      await operations.beginPluginUpdateRun()("pathfoo", "mp", "project");

      // assert -- run one listed no tag and fell back to the marketplace's
      // current copy; run two pins the published tag. A memo bound to the
      // binding rather than to the run would serve run one's tag-less
      // listing again and leave the record with no tag version. GV-01: the
      // declared 1.0.0 carries the tag's commit.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces.mp?.plugins.pathfoo;
      assert.deepStrictEqual(
        [record?.version, record?.resolvedVersion, record?.resolvedSha],
        [`1.0.0-${oid.slice(0, 12)}`, "1.2.0", oid],
      );
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a disabled pin refresh swallows post-commit clone cleanup failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-disabled-clone-gc-fail-");
    let oldCloneRoot: string | undefined;
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      oldCloneRoot = seeded.oldCloneRoot;
      assert.ok(oldCloneRoot !== undefined);
      const locations = locationsFor("project", cwd);
      await markGitPluginDisabled(locations);
      const stateWatch = observeStateTransition(
        (state) => state.marketplaces["mp"]?.plugins["gp"]?.resolvedSha === SHA_NEW,
        () => {
          chmodSync(locations.pluginClonesDir, 0o000);
        },
      );
      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run, notifications } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      await chmod(locations.pluginClonesDir, 0o700);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW);
      assert.equal(record?.enabled, false);
      assert.equal(notifications.length, 1);
      assert.equal(await pathExists(oldCloneRoot), true);
    } finally {
      const locations = locationsFor("project", cwd);
      await chmod(locations.pluginClonesDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GIT-01 unpinned update: refreshes the mirror in place and re-anchors the record to the per-commit copy at its HEAD sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-unpinned-swap-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        // Unpinned entry: no sha, no ref -> the probe routes to the mirror seam.
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // The mirror seam reads HEAD from the refreshed clone (no resolveRemoteRef).
      const { gitOps, state: gitState } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // The mirror route reads HEAD directly; it does NOT resolve a remote ref.
      assert.equal(
        gitState.resolveRemoteRefCalls.length,
        0,
        "unpinned mirror update reads HEAD, not resolveRemoteRef",
      );

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW, "records the refreshed mirror HEAD sha");
      assert.equal(record?.version, "9.9.9", "VER-01: version is the declared version");

      // GIT-01: the record anchors to the per-commit copy at the mirror HEAD.
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      const copyKey = pluginCloneKey(cloneUrl, SHA_NEW);
      assert.equal(
        record?.resolvedSource,
        await locations.pluginCloneDir(copyKey),
        "resolvedSource anchors to the per-commit copy",
      );
      assert.equal(await pathExists(mirrorRoot), true, "the mirror clone materialized");
      // The old per-sha clone is no longer referenced -> GC sweeps it.
      assert.equal(await pathExists(seeded.oldCloneRoot ?? ""), false, "old per-sha clone GC'd");

      // GIT-02 derive-not-persist: the post-swap GC leaves the new copy and the
      // mirror of its URL, and no persisted migration artifact.
      const { readdir } = await import("node:fs/promises");
      const cloneEntries = (await readdir(locations.pluginClonesDir)).sort();
      assert.deepEqual(
        cloneEntries,
        [pluginMirrorKey(cloneUrl), copyKey].sort(),
        "plugin-clones/ holds the mirror and the new copy after the sweep",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-11: an update moves a record that names the mirror at its HEAD onto the per-commit copy", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-mirror-record-");
    try {
      // arrange -- a record made before per-commit copies: its root is the
      // mirror and its sha is the mirror's HEAD.
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_NEW,
      });
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      const before = await loadState(locations.extensionRoot);
      const seededRecord = before.marketplaces["mp"]?.plugins["gp"];
      assert.ok(seededRecord !== undefined);
      seededRecord.resolvedSource = mirrorRoot;
      await saveState(locations.extensionRoot, before);
      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      // assert
      assert.deepEqual(notifications, [
        {
          message: "● mp [project]\n  ● gp v9.9.9 → v9.9.9 (updated)\n\n/reload to pick up changes",
        },
      ]);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.deepStrictEqual(
        { version: record?.version, sha: record?.resolvedSha, root: record?.resolvedSource },
        {
          version: "9.9.9",
          sha: SHA_NEW,
          root: await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW)),
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-06 / D-78-01 shared clone NOT GC'd: two git plugins share the old url+sha -> updating one keeps the old clone (the second still references it)", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-shared-clone-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture-new");
      // gp updates SHA_OLD -> SHA_NEW; sibling "other" stays pinned at SHA_OLD,
      // so the SHA_OLD clone must SURVIVE the GC (still referenced).
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
        extraPlugins: {
          other: {
            entrySource: { source: "url", url: cloneUrl, sha: SHA_OLD },
            recordedSha: SHA_OLD,
          },
        },
      });

      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        // Update ONLY gp; "other" keeps referencing the SHA_OLD clone.
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha, SHA_NEW, "gp swapped");
      assert.equal(
        after.marketplaces["mp"]?.plugins["other"]?.resolvedSha,
        SHA_OLD,
        "sibling still pinned at the old sha",
      );
      assert.equal(
        await pathExists(seeded.oldCloneRoot ?? ""),
        true,
        "the shared old clone SURVIVES because the sibling still references it",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 / NFR-3 / SRC-01 vanished repo: unpinned mirror update whose clone throws -> fails with its cause; plugin stays on recorded sha, existing REASONS token, no new token", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-vanished-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const seeded = await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // The upstream repo vanished: the mirror seam's cold clone throws a
      // DNS-resolution failure (errno ENOTFOUND) -- the network-unreachable
      // class. The mirror key has no warm dir, so the seam materializes cold and
      // the clone throw propagates through the probe unchanged.
      const networkError = new Error("getaddrinfo ENOTFOUND example.com") as NodeJS.ErrnoException;
      networkError.code = "ENOTFOUND";
      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: networkError,
      });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      // NFR-3 fail-clean: the plugin STAYS on its recorded sha (no swap).
      assert.equal(record?.resolvedSha, SHA_OLD, "plugin stays on its recorded sha");
      assert.equal(record?.version, "9.9.9", "version stays at the recorded version");
      // The old clone is untouched (still referenced).
      assert.equal(await pathExists(seeded.oldCloneRoot ?? ""), true, "recorded clone untouched");
      // A failure surfaced through the EXISTING network-unreachable REASON token
      // (no new token); the plugin declined its swap and stayed put.
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ gp v9.9.9 (failed) {network unreachable}\n    cause: getaddrinfo ENOTFOUND example.com",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * PURL-03 / D-77-03: seed a git-subdir plugin whose monorepo fixture carries the
 * plugin tree under `plugins/p`, with an installed record pinned at
 * `recordedSha` (warm old clone on disk). The marketplace source stays path so
 * syncCloneOnce is a NFR-5 no-op; only the PLUGIN entry is git-subdir.
 */
async function seedGitSubdirMarketplace(opts: {
  cwd: string;
  cloneUrl: string;
  fixtureRepoDir: string;
  entrySource: unknown;
  recordedSha: string;
}): Promise<{ oldCloneRoot: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const pluginDir = path.join(opts.fixtureRepoDir, "plugins", "p");
  await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "gp", version: "9.9.9" }),
  );
  const skillDir = path.join(pluginDir, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "gp", source: opts.entrySource }] }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Warm old clone at the recorded sha; the record anchors to its subdir root.
  const oldCloneRoot = await locations.pluginCloneDir(
    pluginCloneKey(opts.cloneUrl, opts.recordedSha),
  );
  await mkdir(path.dirname(oldCloneRoot), { recursive: true });
  await cp(opts.fixtureRepoDir, oldCloneRoot, { recursive: true });

  const record = makePluginRecord(`sha-${opts.recordedSha.slice(0, 12)}`);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
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
            ...record,
            resolvedSource: path.join(oldCloneRoot, "plugins", "p"),
            resolvedSha: opts.recordedSha,
          },
        },
      },
    },
  });

  return { oldCloneRoot };
}

test("PURL-03 pinned git-subdir update: the new clone's subdir anchors the pluginRoot and the ref hint threads into the clone seam", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-subdir-pinned-");
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // Pinned sha bump PLUS a ref: resolvePluginPin returns the ref so the
        // re-clone consumes it as the singleBranch fetch hint.
        entrySource: {
          source: "git-subdir",
          url: cloneUrl,
          path: "plugins/p",
          sha: SHA_NEW,
          ref: "main",
        },
        recordedSha: SHA_OLD,
      });

      const { gitOps, state: gitState } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined, "a state record survives the swap");
      assert.equal(record.resolvedSha, SHA_NEW, "resolvedSha swaps to the new manifest sha");
      // D-16-09: the commit moved, so it is an update at the same declared version.
      assert.equal(record.version, "9.9.9", "VER-01: version is the declared version");

      const newCloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      assert.equal(
        record.resolvedSource,
        path.join(newCloneRoot, "plugins", "p"),
        "resolvedSource anchors to the SUBDIR under the new clone root (never the monorepo root)",
      );
      assert.equal(gitState.cloneCalls[0]?.ref, "main", "the re-clone consumed the ref hint");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PURL-03 pinned git-subdir update whose declared path is ABSENT in the new clone declines {no longer installable}; plugin stays on its recorded sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-subdir-missing-");
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // The new pinned tree does NOT carry plugins/missing.
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/missing", sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      // Fail-clean: the missing-subdir candidate declines; no swap.
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /\{no longer installable\}/,
        "the structural missing-subdir decline renders the existing REASON token",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GIT-01 unpinned git-subdir update: the per-commit copy's subdir anchors the pluginRoot at the mirror HEAD sha", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-subdir-unpinned-");
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        // Unpinned (no sha) with a ref: routes to the mirror seam with the
        // ref hint threaded.
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/p", ref: "main" },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, run } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSha, SHA_NEW, "records the refreshed mirror HEAD sha");
      const copyRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      assert.equal(
        record?.resolvedSource,
        path.join(copyRoot, "plugins", "p"),
        "resolvedSource anchors to the SUBDIR under the per-commit copy",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-01 unpinned git-subdir update whose declared path is ABSENT in the refreshed mirror declines {no longer installable}", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-subdir-unpinned-missing-");
    try {
      const cloneUrl = "https://example.com/org/monorepo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitSubdirMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        entrySource: { source: "git-subdir", url: cloneUrl, path: "plugins/missing" },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /\{no longer installable\}/,
        "the mirror-route missing-subdir decline renders the existing REASON token",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin update authentication: a pinned provider update threads auth to the clone", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-auth-provider-");
    try {
      // arrange
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo", sha: SHA_NEW },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });
      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const credentialOps = makeCredentialOps();
      const deviceFlowHttp = makeDeviceFlowHttp();
      const memoized: AuthAttemptResult = {
        ok: false,
        reason: "memoized authentication decline",
      };
      const authMemo = new Map<string, AuthAttemptResult>([["github.com", memoized]]);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
        authMemo,
      });

      // assert
      assert.equal(captured.cloneAuth?.credentialOps, credentialOps);
      assert.equal(captured.cloneAuth?.host, "github.com");
      assert.ok(captured.cloneAuth?.kind === "device-flow");
      assert.deepEqual(await captured.cloneAuth.onAuthRequired(), memoized);
      assert.equal(authMemo.size, 1);
      assert.equal(notifications.length, 1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin update authentication: a run without a supplied authMemo shares one Device Flow between the marketplace sync and the plugin clone", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-auth-run-memo-");
    try {
      // arrange
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo", sha: SHA_NEW },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });
      const locations = locationsFor("project", cwd);
      const seeded = await loadState(locations.extensionRoot);
      const marketplace = seeded.marketplaces.mp;
      assert.ok(marketplace !== undefined);
      await saveState(locations.extensionRoot, {
        ...seeded,
        marketplaces: {
          ...seeded.marketplaces,
          mp: { ...marketplace, source: githubSource("https://github.com/test/mp#main") },
        },
      });
      const { gitOps: recordingGitOps, state } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture"),
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const gitOps: typeof recordingGitOps = {
        ...recordingGitOps,
        async fetch(fetchOptions) {
          if (fetchOptions.auth?.kind === "device-flow") {
            await fetchOptions.auth.onAuthRequired();
          }

          await recordingGitOps.fetch(fetchOptions);
        },
      };
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const clonePullSeam: UpdateCloneCacheSeam = {
        ...seam,
        materializePluginClone: async (args) => {
          const auth = args.resolveAuth();
          if (auth.kind === "device-flow") {
            await auth.onAuthRequired();
          }

          return seam.materializePluginClone(args);
        },
      };
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: DEVICE_CODE,
        defaultPoll: { kind: "access_denied" },
      });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        gitOps,
        cloneCacheSeam: clonePullSeam,
        credentialOps: makeCredentialOps(),
        deviceFlowHttp: deviceFlow.http,
      });

      // assert
      assert.equal(state.fetchCalls.length, 1, "the marketplace syncs once");
      assert.ok(captured.cloneAuth?.kind === "device-flow", "the clone carries the auth bundle");
      assert.equal(
        deviceFlow.calls.requestCode.length,
        1,
        "the sync and the clone share one Device Flow",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin update authentication: an unpinned provider update threads auth to the mirror", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-auth-mirror-");
    try {
      // arrange
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo" },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });
      const { gitOps } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture"),
        head: SHA_NEW,
        localRefs: { "refs/heads/main": SHA_NEW },
        remoteRefs: { "refs/remotes/origin/main": SHA_NEW },
      });
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const credentialOps = makeCredentialOps();
      const deviceFlowHttp = makeDeviceFlowHttp();
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seam,
        credentialOps,
        deviceFlowHttp,
      });

      // assert
      assert.equal(captured.cloneAuth?.credentialOps, credentialOps);
      assert.equal(captured.cloneAuth?.host, "github.com");
      assert.equal(captured.cloneAuth?.kind, "device-flow");
      assert.equal(captured.pinAuth, undefined);
      assert.equal(notifications.length, 1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("updateSinglePlugin keeps a recorded provider SHA offline without an auth context", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-auth-cascade-warm-");
    const previousCwd = process.cwd();
    t.after(async () => {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    });
    await seedGitUpdateMarketplace({
      cwd,
      cloneUrl: "https://github.com/org/repo",
      entrySource: { source: "github", repo: "org/repo", sha: SHA_OLD },
      recordedSha: SHA_OLD,
      versionTag: "9.9.9",
    });
    process.chdir(cwd);

    // act
    const outcome = await updateSinglePlugin("gp", "mp", "project");

    // assert
    assert.deepEqual(outcome, {
      partition: "unchanged",
      name: "gp",
      fromVersion: "9.9.9",
      toVersion: "9.9.9",
      declaresAgents: false,
      declaresMcp: false,
      constraint: undefined,
      declaresWorkflows: false,
    });
  });
});

test("GHB-03: a GitHub-source plugin update on an invalid base fails the update command", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-plugin-invalid-base-");
    try {
      // arrange
      await seedGitUpdateMarketplace({
        cwd,
        cloneUrl: "https://github.com/org/repo",
        entrySource: { source: "github", repo: "org/repo" },
        recordedSha: SHA_OLD,
        versionTag: "9.9.9",
      });
      setGitHubBaseUrl(t, "http://mirror.example");
      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingUpdateSeam(gitOps);
      const { ctx, verifyBoundary } = createNotificationBoundary(0);

      // act & assert
      await assert.rejects(
        () =>
          updatePlugins({
            ctx,
            run: runWithNothingLoaded(),
            scope: "project",
            cwd,
            target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
            cloneCacheSeam: seam,
            credentialOps: makeCredentialOps(),
            deviceFlowHttp: makeDeviceFlowHttp(),
          }),
        (error: unknown) => {
          assert.deepStrictEqual(
            error,
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          );
          return true;
        },
      );
      assert.deepStrictEqual(captured, { pinAuth: undefined, cloneAuth: undefined });
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-03: the cascade's single-plugin update rethrows an invalid base", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-cascade-invalid-base-");
    const previousCwd = process.cwd();
    t.after(async () => {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    });
    await seedGitUpdateMarketplace({
      cwd,
      cloneUrl: "https://github.com/org/repo",
      entrySource: { source: "github", repo: "org/repo" },
      recordedSha: SHA_OLD,
      versionTag: "9.9.9",
    });
    setGitHubBaseUrl(t, "http://mirror.example");
    process.chdir(cwd);

    // act & assert
    await assert.rejects(
      () => createUpdateOperations().beginPluginUpdateRun()("gp", "mp", "project"),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
  });
});

test("NFR-3 device-flow auth failure: a clone throw shaped UserCanceledError classifies as {authentication required}, not {no longer installable}", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-git-usercanceled-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir,
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl },
        recordedSha: SHA_OLD,
      });

      // An unsuccessful device-flow auth (denied / expired / poll network
      // error) makes platform/git.ts's onAuth return `{ cancel: true }`, which
      // isomorphic-git throws as `UserCanceledError` -- NOT HttpError 401/403.
      const authError = Object.assign(new Error("cancelled"), { code: "UserCanceledError" });
      const { gitOps } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        cloneThrows: authError,
      });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamWith(gitOps),
      });

      const locations = locationsFor("project", cwd);
      const after = await loadState(locations.extensionRoot);
      // NFR-3 fail-clean: the plugin STAYS on its recorded sha (no swap).
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"]?.resolvedSha,
        SHA_OLD,
        "plugin stays on its recorded sha",
      );
      // The bare auth row carries no cause line, as install's does.
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ gp v9.9.9 (failed) {authentication required}",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SUB-02 -- end-to-end ${CLAUDE_PROJECT_DIR} delivery through the update path
//
// update's prepareUpdateHandles threads `cwd` into every stage input by hand
// (an optional field the compiler cannot enforce). A refactor that drops the
// `cwd` line would compile, pass the rest of the suite, and silently ship
// un-substituted project dirs on the update path. This test seeds a
// project-scope fixture whose skill/command/agent bodies carry
// ${CLAUDE_PROJECT_DIR} and ${CLAUDE_SKILL_DIR}, updates to a new version, and
// asserts the re-staged files -- closing the silent-miss gap end-to-end.
// ───────────────────────────────────────────────────────────────────────────

test("SUB-02: project-scope update substitutes ${CLAUDE_PROJECT_DIR} to the install cwd in skill, command, and agent files; keeps ${CLAUDE_SKILL_DIR} literal in command and agent", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-sub02-proj-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true, hasCommand: true, hasAgent: true },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Overwrite the seeded plugin source with token-bearing bodies so the
      // update re-stages content that exercises ${CLAUDE_PROJECT_DIR} and
      // ${CLAUDE_SKILL_DIR} substitution. The first materialization is the
      // update itself (seedPathMarketplace only seeds a state record).
      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(
        path.join(pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: tool\n---\n\nProject: ${CLAUDE_PROJECT_DIR}\n",
      );
      await writeFile(
        path.join(pluginRoot, "commands", "deploy.md"),
        "# deploy\n\nProject: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
      );
      await writeFile(
        path.join(pluginRoot, "agents", "bot.md"),
        "---\nname: bot\ntools: Read,Grep\n---\n\nProject: ${CLAUDE_PROJECT_DIR}\nSkill: ${CLAUDE_SKILL_DIR}\n",
      );

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);

      const skillBody = await readFile(
        path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"),
        "utf8",
      );
      assert.ok(
        skillBody.includes(`Project: ${cwd}`),
        `skill: expected ${cwd} for projectDir, got: ${skillBody}`,
      );
      assert.equal(
        skillBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "skill: no remaining ${CLAUDE_PROJECT_DIR}",
      );

      const commandBody = await readFile(
        path.join(locations.promptsTargetDir, "hello:deploy.md"),
        "utf8",
      );
      assert.ok(
        commandBody.includes(`Project: ${cwd}`),
        `command: expected ${cwd} for projectDir, got: ${commandBody}`,
      );
      assert.equal(
        commandBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "command: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      // ${CLAUDE_SKILL_DIR} is skill-scoped -- commands receive no skillDir, so
      // it stays literal.
      assert.ok(
        commandBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "command: expected literal ${CLAUDE_SKILL_DIR}, got: " + commandBody,
      );

      const agentBody = await readFile(
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md"),
        "utf8",
      );
      assert.ok(
        agentBody.includes(`Project: ${cwd}`),
        `agent: expected ${cwd} for projectDir, got: ${agentBody}`,
      );
      assert.equal(
        agentBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "agent: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      assert.ok(
        agentBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "agent: expected literal ${CLAUDE_SKILL_DIR}, got: " + agentBody,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MENV-04: project-scope update re-derives ${CLAUDE_PLUGIN_ROOT} in mcp.json when the plugin root changes", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-menv04-proj-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasMcp: true,
            rawSourceOverride: "./plugins/hello-OLDROOT",
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      // Relocate the seeded plugin tree to the distinctively-named root the
      // manifest entry points at, and give its .mcp.json a
      // ${CLAUDE_PLUGIN_ROOT}-bearing command + args. The first
      // materialization is the update itself (seedPathMarketplace only seeds
      // a state record).
      const oldRoot = path.join(seeded.marketplaceRoot, "plugins", "hello-OLDROOT");
      await cp(path.join(seeded.marketplaceRoot, "plugins", "hello"), oldRoot, {
        recursive: true,
      });
      const mcpSource = JSON.stringify({
        mcpServers: {
          server1: {
            command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
            args: ["${CLAUDE_PLUGIN_ROOT}/lib"],
          },
        },
      });
      await writeFile(path.join(oldRoot, ".mcp.json"), mcpSource);

      const first = makeCtx();
      await updatePlugins({
        ctx: first.ctx,
        run: first.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const firstErrs = first.notifications.filter((n) => n.severity === "error");
      assert.equal(firstErrs.length, 0, `unexpected errors: ${JSON.stringify(firstErrs)}`);
      const afterFirst = await readFile(locations.mcpAdapterJsonPath, "utf8");
      assert.ok(afterFirst.includes(oldRoot), "first update materializes the old root");

      // Swap the source dir: copy the tree to a new root, bump its version,
      // and point the manifest entry at it -- the plugin root CHANGES.
      const newRoot = path.join(seeded.marketplaceRoot, "plugins", "hello-NEWROOT");
      await cp(oldRoot, newRoot, { recursive: true });
      await writeFile(
        path.join(newRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "1.0.2" }),
      );
      await rewriteManifest(seeded.manifestPath, "mp", {
        hello: { version: "1.0.2", rawSourceOverride: "./plugins/hello-NEWROOT" },
      });

      const second = makeCtx();
      await updatePlugins({
        ctx: second.ctx,
        run: second.run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });
      const secondErrs = second.notifications.filter((n) => n.severity === "error");
      assert.equal(secondErrs.length, 0, `unexpected errors: ${JSON.stringify(secondErrs)}`);

      // Substitution re-derives from the resolver's source, never from a
      // read-back of the prior mcp-adapter.json: the new root lands and no substring
      // of the old root survives anywhere in the raw file bytes.
      const onDisk = await readFile(locations.mcpAdapterJsonPath, "utf8");
      assert.ok(onDisk.includes(newRoot), "new root must be present");
      assert.equal(onDisk.includes("OLDROOT"), false, "no substring of the old root may survive");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WARN-01 / WR-12 / D-99-03: the `(updated)` row names a degraded component
// ──────────────────────────────────────────────────────────────────────────

/**
 * Frontmatter the YAML parser rejects. The bridge writes the component in
 * synthesized, non-model-invocable form rather than failing the ledger, which is
 * exactly why the row reporting the transition has to name it: `list` renders
 * the record's degraded state one command later, and a bare `(updated)` row
 * would contradict it.
 */
const UNPARSEABLE_FRONTMATTER = "---\nname: [unterminated\n---\n\n# Bad\nBody.\n";

test("WR-12: an update whose new source skill will not parse names the kind on the `(updated)` row and takes the warning raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr12-skill-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "skills", "tool", "SKILL.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // This is exercised through the public verb, not through the renderer function:
      // `update` resolves its rows through its own row policies, so a fix
      // applied only to the central row policy would raise the severity while
      // still dropping the brace.
      assert.equal(notifications.length, 1);
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed skill}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // WARN-01: the raise reaches the Pi API severity argument, not only the
      // summary line.
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-12: an update whose new source command will not parse names the command kind on the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr12-command-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });

      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "commands", "deploy.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed command}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-12: an update that degrades BOTH kinds emits both reasons in the canonical order", async () => {
  // Order is the property the catalog byte fixture depends on, and it is why the
  // collection routes through `malformedReasonsForKinds` rather than a
  // verb-local kinds-to-reasons map: the helper owns the canonical emit order,
  // so a local map would produce the right tokens in the wrong order.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr12-both-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const pluginRoot = path.join(seeded.marketplaceRoot, "plugins", "hello");
      await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), UNPARSEABLE_FRONTMATTER);
      await writeFile(path.join(pluginRoot, "commands", "deploy.md"), UNPARSEABLE_FRONTMATTER);

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {malformed skill, malformed command}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01 / SURF-05: an update that materializes an orphan-rewake handler names it on the `(updated)` row", async () => {
  // `update` re-materializes `hooks/hooks.json`, so it introduces this config
  // bug exactly as install, enable and backfill do -- and it is the one verb
  // that INHERITS the shared signal shape, so a bare row here made the
  // inheritance's own claim false. The token names itself and moves NO severity
  // channel: the update was carried out in full.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr01-orphan-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            // rewakeMessage WITHOUT asyncRewake: true -- the resolver's
            // `detectOrphanRewake` sets `orphanRewake` on the candidate.
            hooksJson: {
              PreToolUse: [
                {
                  matcher: "",
                  hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "wake me" }],
                },
              ],
            },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated) {orphan rewake}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, undefined, "orphan rewake stays info");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CR-01: a --partial update that drops a kind AND degrades a component names BOTH axes on one row", async () => {
  // The two axes are independent and the row its own axis owns names each of
  // them. The dropped kind picks the row FORM; the malformed component adds its
  // token to the same brace and carries the info -> warning raise. Before the
  // composer owned both forms, the cascade mapper picked `partially-installed`
  // itself and returned before the malformed axis was ever read, so this row
  // named the dropped kind alone at info severity -- contradicting the record
  // `list` renders one command later, which is the contradiction WR-12 exists
  // to close.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-cr01-both-axes-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // Dropped-kind axis: the candidate re-resolves `partially-available`.
      await makeCandidateUnsupported(seeded.marketplaceRoot, "hello", "1.1.0");
      // Malformed axis: the SUPPORTED skill still materializes, in synthesized
      // form, because its frontmatter will not parse.
      await writeFile(
        path.join(seeded.marketplaceRoot, "plugins", "hello", "skills", "tool", "SKILL.md"),
        UNPARSEABLE_FRONTMATTER,
      );

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        partial: true,
      });

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◉ hello v1.0.0 → v1.1.0 (partially-installed) {malformed skill, unsupported component}\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // The malformed raise reaches the Pi API severity argument. The drop alone
      // stays info on this surface (the `--partial` opt-in is explicit), so a
      // warning here can only have come from the malformed axis.
      assert.equal(notifications[0]?.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a clean update row is byte-identical to before -- no brace, no raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-wr12-clean-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message ?? "",
        "● mp [project]\n" +
          "  ● hello v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "/reload to pick up changes",
      );
      assert.equal(notifications[0]?.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rare failure and rollback arms (D-99-05b). Each case below reaches one arm
// no happy-path test touches, and asserts the arm's observable consequence --
// the rendered row, the closed-set reason, or the state the abort left behind.
// ───────────────────────────────────────────────────────────────────────────

test("WR-05: a bare-form update whose scope state is unreadable fails on the synthetic `(update)` row", async () => {
  // The bare form has no marketplace identity to attribute an enumerate
  // failure to, so it cannot reuse the `<marketplace>` synthetic-row path the
  // `@mp` / `pl@mp` forms take. A truncated state.json is the cheapest real
  // producer: loadState parses eagerly and throws out of enumerateTargets.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-bare-enumfail-");
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(locations.stateJsonPath, '{"schemaVersion": 1, "marketplaces": {');

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({ ctx, run, cwd, target: { kind: "all" } });

      assert.equal(notifications.length, 1, "the enumerate failure emits exactly one notify");
      const body = notifications[0]?.message ?? "";
      // The placeholder occupies BOTH the marketplace-header slot and the row
      // name -- there is no real identity for either. The scope falls back to
      // `user` because the bare form carried no explicit scope.
      assert.match(body, /\n● \(update\) \[user\]\n/, `expected the (update) header in:\n${body}`);
      assert.match(
        body,
        /⊘ \(update\) \(failed\) \{unreadable manifest\}/,
        `expected the (update) row in:\n${body}`,
      );
      // The cause chain is the only carrier of which file could not be read.
      assert.match(body, /cause: state\.json at .* is not valid JSON/, `no cause in:\n${body}`);
      assert.match(body, /Plugin update: 1 failure$/);
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a marketplace target with unreadable state reports its marketplace identity", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-marketplace-enumfail-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(locations.stateJsonPath, '{"schemaVersion": 1, "marketplaces": {');
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /● mp \[project\]/);
      assert.match(notifications[0]?.message ?? "", /⊘ \(mp\) \(failed\) \{unreadable manifest\}/);
      assert.match(notifications[0]?.message ?? "", /Plugin update: 1 failure$/);
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a plugin target with unreadable state reports its plugin identity", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-plugin-enumfail-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(locations.stateJsonPath, '{"schemaVersion": 1, "marketplaces": {');
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /● mp \[project\]/);
      assert.match(notifications[0]?.message ?? "", /⊘ hello \(failed\) \{unreadable manifest\}/);
      assert.doesNotMatch(notifications[0]?.message ?? "", /Plugin update:/);
      assert.equal(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-03 fail-continue: a hooks write that cannot land is aggregated, not thrown past the other bridges", async () => {
  // writeHookConfig atomically renames onto <hooksDir>/<plugin>/hooks.json.
  // A leftover DIRECTORY at that exact path makes the rename fail with EISDIR
  // while every other bridge commits normally -- the fail-continue contract.
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-phase3a-hooks-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hooksJson: {
              hooks: { SessionStart: [{ hooks: [{ type: "command", command: "x" }] }] },
            },
          },
        },
        installedVersions: { hello: "1.0.0" },
      });

      await mkdir(path.join(locations.hooksDir, "hello", "hooks.json"), { recursive: true });

      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /hooks/, `the failing bridge must be named in:\n${body}`);
      assert.match(
        body,
        /Run \/claude:plugin reinstall hello@mp to repair it\./,
        `a phase-3 aggregate must carry the recovery hint in:\n${body}`,
      );

      // The version does NOT advance and the intent-mark survives: the record
      // reports "swap incomplete" until the user reinstalls.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.0.0", "a failed bridge leaves the version at fromVersion");
      assert.equal(record.compatibility.installable, false);
      assert.ok(record.compatibility.notes.includes("update-in-progress"));
      // Fail-continue: the skills bridge committed even though hooks did not.
      assert.deepEqual([...record.resources.skills], ["hello-tool"]);
      // The hooks inventory keeps its pre-update value, matching the disk.
      assert.deepEqual([...record.resources.hooks], []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Wrap the clone-cache seam so `mutate` runs after the new clone materializes.
 * Materialization sits between preflight's state read and the intent-mark's
 * re-read, which is exactly the window the ST-9 guards defend: another process
 * writing state.json while this update holds a stale snapshot of it.
 */
function seamMutatingStateMidUpdate(
  gitOps: GitOps,
  mutate: () => Promise<void>,
): UpdateCloneCacheSeam {
  const base = seamWith(gitOps);
  return {
    ...base,
    materializePluginClone: async (args) => {
      const clone = await base.materializePluginClone(args);
      await mutate();
      return clone;
    },
  };
}

async function markGitPluginDisabled(locations: ReturnType<typeof locationsFor>): Promise<void> {
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces["mp"]?.plugins["gp"];
  assert.ok(record !== undefined);
  record.enabled = false;
  record.resources = {
    skills: [],
    prompts: [],
    agents: [],
    mcpServers: [],
    hooks: [],
    workflows: [],
  };
  await saveState(locations.extensionRoot, state);
}

test("ST-9: a version that advanced under an in-flight update aborts on the intent-mark", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-st9-advanced-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture-new") });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const mid = await loadState(locations.extensionRoot);
          const mp = mid.marketplaces["mp"];
          assert.ok(mp !== undefined, "the racing writer needs the marketplace to be present");
          const racing = mp.plugins["gp"];
          assert.ok(racing !== undefined, "the racing writer needs a record to advance");
          mp.plugins["gp"] = { ...racing, version: "sha-cccccccccccc" };
          await saveState(locations.extensionRoot, mid);
        }),
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ gp v9\.9\.9 \(1111111\) → v9\.9\.9 \(2222222\) \(failed\) \{concurrently updated\}/,
        `the version drift must reach the closed-set reason in:\n${body}`,
      );
      assert.match(body, /was concurrently updated; expected version/, `no cause in:\n${body}`);

      // The abort happens BEFORE the intent-mark writes, so the racing
      // writer's record survives untouched -- no half-applied swap.
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "sha-cccccccccccc", "the racing write is not overwritten");
      assert.equal(record.resolvedSha, SHA_OLD, "no swap landed");
      assert.deepEqual(
        record.compatibility.notes,
        [],
        "no update-in-progress mark was left behind",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ST-9: a record uninstalled under an in-flight update aborts instead of resurrecting it", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-st9-uninstalled-");
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });

      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture-new") });
      const { ctx, run, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const mid = await loadState(locations.extensionRoot);
          const mp = mid.marketplaces["mp"];
          assert.ok(mp !== undefined, "the racing writer needs the marketplace to be present");
          delete mp.plugins["gp"];
          await saveState(locations.extensionRoot, mid);
        }),
      });

      const body = notifications.map((n) => n.message).join("\n");
      assert.match(
        body,
        /⊘ gp v9\.9\.9 \(1111111\) → v9\.9\.9 \(2222222\) \(failed\) \{concurrently uninstalled\}/,
        `the vanished record must reach the closed-set reason in:\n${body}`,
      );
      assert.match(body, /was concurrently uninstalled/, `no cause in:\n${body}`);

      // The uninstall stands: an update must never write back a record the
      // user just removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        after.marketplaces["mp"]?.plugins["gp"],
        undefined,
        "the update must not resurrect the uninstalled record",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a marketplace removed under an in-flight update is not resurrected", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-marketplace-race-");
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      const { gitOps } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture-new"),
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const state = await loadState(locations.extensionRoot);
          delete state.marketplaces["mp"];
          await saveState(locations.extensionRoot, state);
        }),
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /\{concurrently uninstalled\}/);
      assert.match(notifications[0]?.message ?? "", /disappeared from state during update/);
      assert.deepEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a disabled update does not recreate a concurrently removed marketplace", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-disabled-marketplace-race-");
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      await markGitPluginDisabled(locations);
      const { gitOps } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture-new"),
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const state = await loadState(locations.extensionRoot);
          delete state.marketplaces["mp"];
          await saveState(locations.extensionRoot, state);
        }),
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /gp \(skipped\) \{already disabled\}/);
      assert.deepEqual((await loadState(locations.extensionRoot)).marketplaces, {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a disabled update does not recreate a concurrently removed plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-disabled-plugin-race-");
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      await markGitPluginDisabled(locations);
      const { gitOps } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture-new"),
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const state = await loadState(locations.extensionRoot);
          const marketplace = state.marketplaces["mp"];
          assert.ok(marketplace !== undefined);
          delete marketplace.plugins["gp"];
          await saveState(locations.extensionRoot, state);
        }),
      });

      // assert
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /gp \(skipped\) \{already disabled\}/);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"],
        undefined,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a disabled update accepts a concurrent writer that already stored the next pin", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-disabled-next-pin-race-");
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      await seedGitPluginMarketplace({
        cwd,
        cloneUrl,
        fixtureRepoDir: path.join(cwd, "repo-fixture-new"),
        versionTag: "9.9.9",
        entrySource: { source: "url", url: cloneUrl, sha: SHA_NEW },
        recordedSha: SHA_OLD,
      });
      await markGitPluginDisabled(locations);
      const nextCloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, SHA_NEW));
      const { gitOps } = createGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture-new"),
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "gp", marketplace: "mp" },
        cloneCacheSeam: seamMutatingStateMidUpdate(gitOps, async () => {
          const state = await loadState(locations.extensionRoot);
          const record = state.marketplaces["mp"]?.plugins["gp"];
          assert.ok(record !== undefined);
          record.version = "9.9.9";
          record.resolvedSource = nextCloneRoot;
          record.resolvedSha = SHA_NEW;
          record.compatibility = {
            installable: true,
            notes: [],
            supported: ["skills"],
            unsupported: [],
          };
          await saveState(locations.extensionRoot, state);
        }),
      });

      // assert
      assert.equal(notifications.length, 1);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "9.9.9");
      assert.equal(record.resolvedSource, nextCloneRoot);
      assert.equal(record.resolvedSha, SHA_NEW);
      assert.equal(record.enabled, false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-141-03 / D-141-05: the update path reads the bridges' warnings ─────────
//
// It read none of them before, so every staging and discovery warning an
// update produced was dark. The skills and commands halves reach the
// standalone user after the cascade; the agents and mcp halves stay on the
// orchestrated channel.

/**
 * Seed a D-07 collision inside ONE componentPaths.skills entry of the plugin
 * tree: `hello-foo/` and `foo/` both elide to the generated name `hello-foo`
 * (D-141-04), so discovery keeps the localeCompare-first source and reports
 * the loser.
 */
export async function seedCollidingSkills(
  marketplaceRoot: string,
  pluginName = "hello",
): Promise<void> {
  const skillsDir = path.join(marketplaceRoot, "plugins", pluginName, "skills");
  for (const dir of [`${pluginName}-foo`, "foo"]) {
    await mkdir(path.join(skillsDir, dir), { recursive: true });
    await writeFile(path.join(skillsDir, dir, "SKILL.md"), `---\nname: foo\n---\n\n${dir}\n`);
  }
}

for (const mode of ["json", "rpc"]) {
  test(`appends update discovery diagnostics after the cascade in ${mode}`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await createCaseDir("update-machine-diagnostics-");
      try {
        const seeded = await seedPathMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
          installedVersions: { hello: "1.0.0" },
        });
        await seedCollidingSkills(seeded.marketplaceRoot);
        const capture = createJsonCapture();
        const ctx = {
          mode,
          get ui() {
            return capture.ui;
          },
        };
        const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

        // act
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        // assert
        assert.strictEqual(
          (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces["mp"]?.plugins[
            "hello"
          ]?.version,
          "1.0.1",
        );
        assert.deepStrictEqual(capture.entries, [
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
              kind: "cascade",
              severity: "info",
              needsReload: true,
              marketplaces: [
                {
                  name: "mp",
                  scope: "project",
                  plugins: [
                    {
                      name: "hello",
                      id: "hello@mp",
                      scope: "project",
                      reasons: [],
                      status: "updated",
                      from: "1.0.0",
                      to: "1.0.1",
                    },
                  ],
                },
              ],
            },
          },
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
              kind: "diagnostic",
              severity: "warning",
              needsReload: false,
              header: 'Plugin "hello" [project] updated; 1 declared component has a note.',
              lines: [
                'skill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
              ],
            },
          },
        ]);
        capture.assertValid();
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("D-141-03: a standalone updatePlugins run surfaces the skills discovery warning after the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-discwarn-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      // The collision lives in the NEW version's tree, so the swap reaches it.
      await seedCollidingSkills(seeded.marketplaceRoot);

      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
      await updatePlugins({
        ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "hello" [project] updated; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-10: an updateSinglePlugin cascade emits no notification and carries both halves on stagingWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-discwarn-casc-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        // `hasAgent` writes the agent frontmatter with no `description`, which
        // the agents bridge reports as a fallback note -- the hygiene half.
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasAgent: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot);

      const prevCwd = process.cwd();
      process.chdir(cwd);
      let outcome;
      try {
        outcome = await updateSinglePlugin("hello", "mp", "project");
      } finally {
        process.chdir(prevCwd);
      }

      assert.equal(outcome.partition, "updated");
      const warnings = outcome.partition === "updated" ? (outcome.stagingWarnings ?? []) : [];
      assert.deepStrictEqual(warnings, [
        {
          kind: "discovery",
          message: `skill source "hello-foo" in "${path.join(seeded.marketplaceRoot, "plugins", "hello", "skills")}" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.`,
        },
        {
          kind: "hygiene",
          message: "[bot] source description was missing or empty -- using fallback",
        },
      ]);

      // The agents half must NOT reach a standalone run's notifications.
      const cwd2 = await createCaseDir("update-discwarn-std-");
      try {
        const seeded2 = await seedPathMarketplace({
          cwd: cwd2,
          marketplaceRoot: path.join(cwd2, "mp-src"),
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasAgent: true } },
          installedVersions: { hello: "1.0.0" },
        });
        await seedCollidingSkills(seeded2.marketplaceRoot);

        const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });
        await updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd: cwd2,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        assert.deepStrictEqual(notifications, [
          {
            message:
              "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
          },
          {
            message:
              'Plugin "hello" [project] updated; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
            severity: "warning",
          },
        ]);
      } finally {
        await rm(cwd2, { recursive: true, force: true });
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: a bulk update surfaces one diagnostic per updated plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-discwarn-bulk-");
    try {
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasSkill: true },
          world: { version: "1.0.1", hasSkill: true },
        },
        installedVersions: { hello: "1.0.0", world: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot, "hello");
      await seedCollidingSkills(seeded.marketplaceRoot, "world");

      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
      await updatePlugins({
        ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n  ● world v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 2 updated\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "hello" [project] updated; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
        {
          message:
            'Plugin "world" [project] updated; 1 declared component has a note.\n\nskill source "world-foo" in "skills" elides to generated name "world-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-07: a bare update renders the diagnostics in the row order of the marketplace blocks", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-discwarn-order-");
    try {
      // arrange
      // The bare form visits the project scope first, but the rows sort the
      // user-scope "alpha" block ahead of the project-scope "zeta" block.
      const zeta = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "zeta-src"),
        marketplaceName: "zeta",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await seedCollidingSkills(zeta.marketplaceRoot, "hello");
      const alpha = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "alpha-src"),
        marketplaceName: "alpha",
        manifestPlugins: { world: { version: "1.0.1", hasSkill: true } },
        installedVersions: { world: "1.0.0" },
        scope: "user",
      });
      await seedCollidingSkills(alpha.marketplaceRoot, "world");
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);

      // act
      await updatePlugins({ ctx, run: runWithNothingLoaded(), cwd, target: { kind: "all" } });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● alpha [user]\n  ● world v1.0.0 → v1.0.1 (updated)\n\n● zeta [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 2 updated\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "world" [user] updated; 1 declared component has a note.\n\nskill source "world-foo" in "skills" elides to generated name "world-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
        {
          message:
            'Plugin "hello" [project] updated; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * D-PL1-14: make `pluginName`'s mcp prepare throw by giving its one MCP
 * server a key another plugin owns in the project scope's mcp-adapter.json.
 * Returns the refusal the prepare throws.
 */
async function seedForeignMcpServerKey(
  cwd: string,
  marketplaceRoot: string,
  pluginName: string,
): Promise<string> {
  await writeFile(
    path.join(marketplaceRoot, "plugins", pluginName, ".mcp.json"),
    JSON.stringify({ mcpServers: { "rollback-server": { command: "node" } } }),
  );
  const adapterPath = locationsFor("project", cwd).mcpAdapterJsonPath;
  await mkdir(path.dirname(adapterPath), { recursive: true });
  await writeFile(
    adapterPath,
    JSON.stringify({
      mcpServers: {
        [`plugin_${pluginName}_rollback-server_`]: {
          command: "node",
          _piClaudeMarketplace: { plugin: "other-plugin", marketplace: "mp" },
        },
      },
    }),
  );
  return `Refusing to stage MCP server "plugin_${pluginName}_rollback-server_": ${adapterPath} already defines it, and pi-mcp-adapter would load the definition in ${adapterPath}.`;
}

test("D-PL1-14 / D-PL1-22: a direct update whose later target throws in prepare renders only that target's update failed diagnostic", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-failed-prepare-warnings-");
    try {
      // arrange
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          aaa: { version: "1.0.1", hasSkill: true },
          zzz: { version: "1.0.1", hasSkill: true, hasMcp: true },
        },
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot, "aaa");
      await seedCollidingSkills(seeded.marketplaceRoot, "zzz");
      const refusal = await seedForeignMcpServerKey(cwd, seeded.marketplaceRoot, "zzz");
      const { ctx, run, notifications } = makeCtx({ piMcpAdapterLoaded: true });

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: [
            "A plugin operation has failed.",
            "",
            "● mp [project]",
            "  ⊘ zzz v1.0.0 → v1.0.1 (failed) {unreadable manifest}",
            `    cause: ${refusal}`,
            "",
            "Plugin update: 1 failure",
          ].join("\n"),
          severity: "error",
        },
        {
          message:
            "● mp [project]\n  ● aaa v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "zzz" [project] update failed; 1 declared component has a note.\n\nskill source "zzz-foo" in "skills" elides to generated name "zzz-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-14: a direct update whose phase-3 commit fails renders its update failed diagnostic after the cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-failed-phase3-warnings-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          aaa: { version: "1.0.1", hasSkill: true },
          zzz: { version: "1.0.1", hasSkill: true },
        },
        installedVersions: { aaa: "1.0.0", zzz: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot, "zzz");
      await mkdir(locations.skillsTargetDir, { recursive: true });
      await writeFile(path.join(locations.skillsTargetDir, "zzz-tool"), "obstacle");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      const rename = `ENOTDIR: not a directory, rename '${locations.skillsStagingDir}/<uuid>/zzz-tool' -> '${locations.skillsTargetDir}/zzz-tool'`;
      assert.deepStrictEqual(
        notifications.map((notification) => ({
          ...notification,
          message: notification.message.replaceAll(
            /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g,
            "<uuid>",
          ),
        })),
        [
          {
            message: [
              "A plugin operation has failed.",
              "",
              "● mp [project]",
              "  ⊘ zzz v1.0.0 → v1.0.1 (failed) {rollback partial}",
              `    cause: Plugin "zzz" failed during physical replace. Run /claude:plugin reinstall zzz@mp to repair it. -> ${rename}`,
              "    [skills] (rollback failed)",
              `      cause: ${rename}`,
              "",
              "Plugin update: 1 failure",
            ].join("\n"),
            severity: "error",
          },
          {
            message:
              "● mp [project]\n  ● aaa v1.0.0 → v1.0.1 (updated)\n\nPlugin update: 1 updated\n\n/reload to pick up changes",
          },
          {
            message:
              'Plugin "zzz" [project] update failed; 1 declared component has a note.\n\nskill source "zzz-foo" in "skills" elides to generated name "zzz-foo", already produced by skill source "foo"; ignoring duplicate.',
            severity: "warning",
          },
        ],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-14: a failed outcome a direct update keeps renders its update failed diagnostic after the cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-failed-settled-warnings-");
    try {
      // arrange
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot);
      const { ctx, run, notifications } = makeCtx();
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        { saveState: () => Promise.reject(new Error("disk full")) },
        {},
        () =>
          Promise.resolve({
            kind: "settled",
            rows: [
              {
                status: "installed",
                name: "zcore@mp",
                dependencies: [],
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          }),
      );

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: [
            "A plugin operation has failed.",
            "",
            "● mp [project]",
            "  ⊘ hello v1.0.0 (failed)",
            "    cause: disk full",
            "  ● zcore@mp v1.0.0 (installed)",
            "",
            "/reload to pick up changes",
          ].join("\n"),
          severity: "error",
        },
        {
          message:
            'Plugin "hello" [project] update failed; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-14: a cascade target whose prepare throws returns a failed outcome carrying its warnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-failed-cascade-warnings-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true, hasMcp: true } },
        installedVersions: { hello: "1.0.0" },
      });
      await seedCollidingSkills(seeded.marketplaceRoot);
      const refusal = await seedForeignMcpServerKey(cwd, seeded.marketplaceRoot, "hello");
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.ok(outcome.partition === "failed");
      assert.ok(outcome.cause instanceof Error);
      assert.strictEqual(outcome.cause.message, refusal);
      const { cause: _cause, ...withoutCause } = outcome;
      assert.deepStrictEqual(withoutCause, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        notes: [`${refusal}\n\ncause: ${refusal}`],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["unreadable manifest"],
        stagingWarnings: [
          {
            kind: "discovery",
            message: `skill source "hello-foo" in "${path.join(seeded.marketplaceRoot, "plugins", "hello", "skills")}" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.`,
          },
        ],
      });
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { title, failure, expectedReason, expectedCause } of [
  {
    title: "normalizes a non-Error cascade failure without inventing a cause",
    failure: "opaque state failure",
    expectedReason: "unreadable manifest",
    expectedCause: undefined,
  },
  {
    title: "redacts an HTTP cascade failure before constructing its cause",
    failure: Object.assign(new Error("HTTP Error at /private/scope/token.txt"), {
      code: "HttpError",
      data: { statusCode: 503 },
    }),
    expectedReason: "network error",
    expectedCause: "HTTP Error at token.txt",
  },
] as const) {
  test(`D-PL10-11: ${title}`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("update-cascade-failure-cause-");
      const previousCwd = process.cwd();
      try {
        // arrange
        await seedPathMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
          installedVersions: { hello: "1.0.0" },
        });
        process.chdir(cwd);
        const { ctx, run } = makeCtx();
        const isNonError = typeof failure === "string";
        const operations = createPluginUpdateOperations(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
          isNonError
            ? undefined
            : {
                saveState: () => Promise.reject(failure),
              },
          {},
          isNonError
            ? () => {
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- covers defensive normalization of injected throws.
                return Promise.reject(failure);
              }
            : undefined,
        );

        // act
        const outcome = await operations.beginPluginUpdateRun({ ctx, run })(
          "hello",
          "mp",
          "project",
        );

        // assert
        assert.strictEqual(outcome.partition, "failed");
        assert.deepStrictEqual(outcome.reasons, [expectedReason]);
        assert.strictEqual(outcome.cause?.message, expectedCause);
      } finally {
        process.chdir(previousCwd);
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("NREG-01: a clean update outcome omits the notes key entirely", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-nreg-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      const prevCwd = process.cwd();
      process.chdir(cwd);
      let outcome;
      try {
        // The cascade arm folds BOTH halves onto `notes`, so it is the arm
        // where an unconditional spread would be hardest to notice.
        outcome = await updateSinglePlugin("hello", "mp", "project");
      } finally {
        process.chdir(prevCwd);
      }

      assert.equal(outcome.partition, "updated");
      assert.ok(!Object.hasOwn(outcome, "notes"), JSON.stringify(outcome));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── WLIF-02: workflows as the update's sixth bridge ─────────────────────────
//
// `locationsFor` is called INSIDE the `withHermeticHome` closure in every case
// below: the helper sets `process.env.HOME`, which is what the workflow home
// derivation reads. Workflow envelopes are the only artifacts this extension
// writes outside every scope root, so a call outside the closure would point
// `workflowsSavedDir` at the developer's real home and leak a write the test
// never cleans.

/**
 * Write `<pluginRoot>/workflows/<sourceName>.js` for each entry, REPLACING
 * whatever set was there.
 *
 * The replacement is the point. Every behavior worth covering here is about the
 * script set DIFFERING between the from-version tree and the to-version tree,
 * so one helper seeds both: call it before the install, then again with the new
 * set before the update.
 *
 * The default body carries a NAMED `meta` export on purpose. A body without one
 * classifies as SKIPPED and writes zero envelopes, so a case relying on the
 * default would pass for the wrong reason.
 */
async function writeWorkflowScripts(
  marketplaceRoot: string,
  pluginName: string,
  workflows: readonly { sourceName: string; body?: string }[],
): Promise<void> {
  const workflowsDir = path.join(marketplaceRoot, "plugins", pluginName, "workflows");
  await rm(workflowsDir, { force: true, recursive: true });
  if (workflows.length === 0) {
    return;
  }

  await mkdir(workflowsDir, { recursive: true });
  for (const workflow of workflows) {
    await writeFile(
      path.join(workflowsDir, `${workflow.sourceName}.js`),
      workflow.body ??
        `export const meta = { name: "${workflow.sourceName}", description: "does ${workflow.sourceName}" };\n`,
    );
  }
}

/** Directory entries, or `[]` when the directory was never created. */
async function entriesOf(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).sort();
  } catch {
    return [];
  }
}

/**
 * Seed a workflow-bearing plugin at `version` and INSTALL it, so the pre-update
 * record names envelopes that are actually on disk.
 *
 * Installed for real rather than hand-seeded: `previousWorkflowNames` exists to
 * reach the bridge's displace-and-restore path, and a record naming envelopes
 * nothing ever wrote would send that path down its ENOENT-tolerant arm and
 * prove nothing.
 */
async function seedInstalledWorkflowPlugin(opts: {
  readonly cwd: string;
  readonly version: string;
  readonly workflows: readonly { sourceName: string; body?: string }[];
}): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const { manifestPath } = await seedPathMarketplace({
    cwd: opts.cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    // SNM-34: the plugin's own `plugin.json` carries no version, so the
    // manifest entry is what reaches the record and a `rewriteManifest` bump
    // actually moves it. With the version mirrored into `plugin.json` the
    // update resolves as `unchanged` and never prepares anything.
    manifestPlugins: {
      hello: { version: opts.version, hasSkill: true, omitPluginJsonVersion: true },
    },
  });
  await writeWorkflowScripts(marketplaceRoot, "hello", opts.workflows);
  const seed = makeCtx();
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
  await installPlugin({
    ctx: seed.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: opts.cwd,
    marketplace: "mp",
    plugin: "hello",
  });
  return { marketplaceRoot, manifestPath };
}

test("WLIF-02: an abort after the workflows prepare leaves no workflows staging tree", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-abort-");
    const previousCwd = process.cwd();
    try {
      // arrange -- version B adds a second workflow, so the prepare has a tree
      // to write before the intent mark refuses.
      const locations = locationsFor("project", cwd);
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "wave" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });

      // The version bump lands at the intent mark's locked load, so the ST-9
      // check fires there -- after every handle, workflows included, exists.
      const concurrentWriter = mutateAtFirstLockedLoad((state) => {
        const record = state.marketplaces["mp"]?.plugins["hello"];
        assert.ok(record !== undefined);
        record.version = "9.9.9";
      });
      process.chdir(cwd);

      // act
      const outcome = await concurrentWriter.updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(concurrentWriter.fired(), true);
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(outcome.reasons, ["concurrently updated"]);
      assert.deepEqual(
        await entriesOf(locations.workflowsStagingDir),
        [],
        "the workflows handle must unwind on the abort path, not linger as a staging tree",
      );
      // The from-version envelope is untouched: the prepare wrote only into
      // staging, so an abort before the commit cannot have moved it.
      assert.deepEqual(await entriesOf(locations.workflowsSavedDir), ["hello:greet.json"]);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-02: a plugin with no workflows and an empty inventory stages nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-noop-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- WPTH-05: the noop short-circuit must not bring the host
      // engine's storage root into existence for a plugin that ships no
      // workflows, so the assertion is on the directories, not on a name list.
      assert.equal(
        await pathExists(locations.workflowsStagingDir),
        false,
        "no admitted workflow and no recorded name means no staging tree",
      );
      assert.equal(await pathExists(locations.workflowsSavedDir), false);
      assert.deepEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources
          .workflows,
        [],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-02: a workflow version B cannot admit reaches the standalone diagnostic channel", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-warn-direct-");
    try {
      // arrange -- version B adds a script with no `meta` export at all, which
      // the decision layer skips.
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "broken", body: "export default function run() {}\n" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      // The session exposes the host workflow engine, so the verb's own row
      // stays `info` and the severity filter below isolates the diagnostic.
      const { ctx, run, notifications } = makeCtx({ workflowEngineLoaded: true });

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- the same channel the skills and commands discovery warnings
      // reach, in the install tense, after the verb's own row.
      const diagnostics = notifications.filter((n) => n.severity === "warning");
      assert.equal(diagnostics.length, 1, JSON.stringify(notifications));
      assert.match(
        diagnostics[0]?.message ?? "",
        /Plugin "hello" \[project\] updated; 1 declared component has a note\./,
      );
      assert.match(diagnostics[0]?.message ?? "", /workflow script "broken\.js"/);
      assert.match(diagnostics[0]?.message ?? "", /was not installed/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-02: the same workflow warning rides the cascade outcome's stagingWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-warn-cascade-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "broken", body: "export default function run() {}\n" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(outcome.partition, "updated");
      const warnings = outcome.partition === "updated" ? (outcome.stagingWarnings ?? []) : [];
      assert.deepStrictEqual(warnings, [
        {
          kind: "discovery",
          message: `workflow script "broken.js" in "${path.join(marketplaceRoot, "plugins", "hello", "workflows")}" was not installed: broken.js declares no \`meta\`, so there is nothing to install`,
        },
      ]);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** The envelope the saved directory holds for `generatedName`. */
async function readEnvelope(savedDir: string, generatedName: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(savedDir, `${generatedName}.json`), "utf8"));
}

test("WLIF-02: an update that adds a workflow writes its envelope and records the placed name", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-added-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "wave" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(await entriesOf(locations.workflowsSavedDir), [
        "hello:greet.json",
        "hello:wave.json",
      ]);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.deepEqual(record?.resources.workflows, ["hello:greet", "hello:wave"]);
      assert.equal(record?.version, "2.10.0");
      assert.deepEqual(
        await entriesOf(locations.workflowsStagingDir),
        [],
        "a committed staging tree is cleaned up, not retained",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-02: a workflow the new version withdrew loses its envelope and its recorded name", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-withdrawn-");
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }, { sourceName: "wave" }],
      });
      assert.deepEqual(await entriesOf(locations.workflowsSavedDir), [
        "hello:greet.json",
        "hello:wave.json",
      ]);
      await writeWorkflowScripts(marketplaceRoot, "hello", [{ sourceName: "greet" }]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(await entriesOf(locations.workflowsSavedDir), ["hello:greet.json"]);
      assert.deepEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources
          .workflows,
        ["hello:greet"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-02: a workflow the new version renamed lands under the new name with the new bytes", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-renamed-");
    try {
      // arrange -- ONE source file whose declared `meta.name` moves, which is
      // what a rename looks like from the record's side.
      const locations = locationsFor("project", cwd);
      const versionBSource =
        'export const meta = { name: "salute", description: "greets formally" };\n';
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet", body: versionBSource },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- the byte-content check is the one that catches a commit that
      // recorded the new name over the old version's script.
      assert.deepEqual(await entriesOf(locations.workflowsSavedDir), ["hello:salute.json"]);
      assert.deepEqual(await readEnvelope(locations.workflowsSavedDir, "hello:salute"), {
        name: "hello:salute",
        description: "greets formally",
        script: versionBSource,
      });
      assert.deepEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources
          .workflows,
        ["hello:salute"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-06: an update that withdrew a workflow names the reload remedy", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-stale-");
    try {
      // arrange -- the same withdrawal shape as the WLIF-02 case above, read
      // here through the RENDERED row rather than through the record.
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }, { sourceName: "wave" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [{ sourceName: "greet" }]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- `hello:wave` is in the pre-update record and not in what this
      // re-stage placed, so its command is registered over nothing until the
      // reload the trailer names. Severity `warning`: the update WAS applied.
      // WDEP-02: the update also declares workflows into a session with no host
      // engine, so the marker composes after the content token.
      const row = notifications.at(-1);
      assert.ok(row !== undefined);
      assert.equal(row.severity, "warning");
      assert.match(
        row.message,
        /\(updated\) \{stale workflow command, requires pi-dynamic-workflows\}/u,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WLIF-06: an update that re-placed every recorded workflow stamps nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-stale-none-");
    try {
      // arrange -- the SAME verb over a tree whose workflow set did not change.
      // Every recorded name is in the staged set, so the difference is empty
      // and this is the ordinary re-place. The session exposes the host
      // workflow engine, so the only axis left that could raise the row is the
      // retirement this case is about.
      const { manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }],
      });
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const { ctx, run, notifications } = makeCtx({ workflowEngineLoaded: true });

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- no brace, no severity raise: the bytes this row rendered
      // before the token existed.
      const row = notifications.at(-1);
      assert.ok(row !== undefined);
      assert.equal(row.severity, undefined);
      assert.doesNotMatch(row.message, /stale workflow command/u);
      assert.match(row.message, /\(updated\)\n/u);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CR-02: the intent-mark window widens the recorded inventory to the union", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-union-");
    let unionDuringWindow: string[] | undefined;
    try {
      // arrange -- version B keeps `greet`, withdraws `wave`, adds `zap`, so the
      // union is a strict superset of BOTH the recorded set and the staged set.
      const locations = locationsFor("project", cwd);
      const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
        cwd,
        version: "1.0.0",
        workflows: [{ sourceName: "greet" }, { sourceName: "wave" }],
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "zap" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      // Read off the PERSISTED file at the moment the intent mark lands: the
      // union has to be observable to a second process mid-commit, which a
      // return value could never demonstrate.
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        (state) => {
          unionDuringWindow = [
            ...(state.marketplaces["mp"]?.plugins["hello"]?.resources.workflows ?? []),
          ];
        },
      );
      const { ctx, run } = makeCtx();

      // act
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.deepEqual(unionDuringWindow, ["hello:greet", "hello:wave", "hello:zap"]);
      // ...and the finalize window narrows it back to what the commit staged.
      assert.deepEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources
          .workflows,
        ["hello:greet", "hello:zap"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a workflows staging-cleanup leak is a recorded failure over a committed record", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-leak-");
    const previousCwd = process.cwd();
    let stagingDirLocked: string | undefined;
    try {
      // arrange -- every sibling bridge has something to write, so a workflows
      // failure that rolled one of them back would be visible.
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.0",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
            omitPluginJsonVersion: true,
          },
        },
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "wave" },
      ]);
      const seed = makeCtx();
      const installPlugin = createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      await installPlugin({
        ctx: seed.ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "zap" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(before !== undefined);

      // The intent mark runs after every prepare and before the first commit,
      // so sealing the staging PARENT there leaves the renames working and
      // fails only the post-commit `rm` of the staging root.
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          chmodSync(locations.workflowsStagingDir, 0o500);
          stagingDirLocked = locations.workflowsStagingDir;
        },
      );
      process.chdir(cwd);

      // act
      const outcome = await stateWatch.updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(stateWatch.fired(), true);
      assert.equal(outcome.partition, "failed");
      const workflowFailure = (outcome.phaseFailures ?? []).find((f) => f.phase === "workflows");
      assert.ok(workflowFailure !== undefined, JSON.stringify(outcome.phaseFailures));
      assert.match(workflowFailure.msg, /workflows staging cleanup leak/);

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      // WR-01: the leak is a failure of the CLEANUP, not of the commit -- every
      // envelope reached its target and `hello:wave` was retired -- so the
      // record is what the commit staged. Keying this off the failure set
      // instead would re-add `hello:wave`, whose envelope now sits in the
      // leaked `.previous/` tree rather than at its target, and the record
      // would name a file that is not there.
      assert.deepEqual(record?.resources.workflows, ["hello:greet", "hello:zap"]);
      assert.equal(
        await pathExists(path.join(locations.workflowsSavedDir, "hello:wave.json")),
        false,
        "the retired envelope is gone from the saved directory, so naming it would be false",
      );
      // SC#2: a workflows failure never rolls back a sibling's inventory. Each
      // sibling declares the same components in both versions, so every one of
      // these arrays is non-empty and unchanged from the install.
      assert.deepEqual(record?.resources.skills, before.resources.skills);
      assert.deepEqual(record?.resources.prompts, before.resources.prompts);
      assert.deepEqual(record?.resources.agents, before.resources.agents);
      assert.deepEqual(record?.resources.mcpServers, before.resources.mcpServers);
      assert.equal(before.resources.skills.length > 0, true);
      assert.equal(before.resources.prompts.length > 0, true);
      assert.equal(before.resources.agents.length > 0, true);
      assert.equal(before.resources.mcpServers.length > 0, true);
      // All-or-nothing: the aggregate is non-empty, so no version bump.
      assert.equal(record?.version, "1.0.0");
    } finally {
      if (stagingDirLocked !== undefined) {
        await chmod(stagingDirLocked, 0o700);
      }

      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CR-01: a phase-3 leak reaches the user with its path intact", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-leak-redact-");
    const previousCwd = process.cwd();
    let stagingDirLocked: string | undefined;
    try {
      // arrange -- every sibling bridge has something to write, so a workflows
      // failure that rolled one of them back would be visible.
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.0",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
            omitPluginJsonVersion: true,
          },
        },
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "wave" },
      ]);
      const seed = makeCtx();
      const installPlugin = createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      await installPlugin({
        ctx: seed.ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      await writeWorkflowScripts(marketplaceRoot, "hello", [
        { sourceName: "greet" },
        { sourceName: "zap" },
      ]);
      await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(before !== undefined);

      // The intent mark runs after every prepare and before the first commit,
      // so sealing the staging PARENT there leaves the renames working and
      // fails only the post-commit `rm` of the staging root.
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        () => {
          chmodSync(locations.workflowsStagingDir, 0o500);
          stagingDirLocked = locations.workflowsStagingDir;
        },
      );
      process.chdir(cwd);

      // act -- the DIRECT entrypoint, which is the arm that notifies.
      const { ctx, run, notifications } = makeCtx();
      await stateWatch.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(stateWatch.fired(), true);
      const row = notifications.at(-1);
      assert.ok(row !== undefined);
      // CR-01: the phase-3 composer restates nothing. The leak text is a
      // manual-recovery instruction -- the tree it names is the one an operator
      // has to go and remove -- so the composer hands it to the renderer
      // verbatim, absolute path included, and the renderer walks the whole
      // `.cause` chain the same way.
      assert.match(row.message, /failed to clean up workflows staging directory/u);
      assert.equal(
        row.message.includes(locations.workflowsStagingDir),
        true,
        "the leak names the tree an operator has to remove, in full",
      );
    } finally {
      if (stagingDirLocked !== undefined) {
        await chmod(stagingDirLocked, 0o700);
      }

      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** The envelope body version A of `hello:greet` carries. */
const GREET_VERSION_A_SOURCE =
  'export const meta = { name: "greet", description: "does greet" };\n';

/**
 * WR-03: the deterministic workflows-failure vehicle every case below drives.
 *
 * Version A installs `greet`. Version B adds `wave`, and a FOREIGN envelope is
 * planted at version B's `hello:wave` target -- a name the pre-update record
 * does not hold. The bridge's ownership pre-check runs over the whole target
 * set BEFORE the first rename, so the commit refuses by class and provably
 * places nothing, which is what lets the same vehicle pin the record narrowing
 * as well as the failure's identity.
 *
 * Planted on the filesystem rather than simulated by patching a module: this
 * repository exposes no test-only seams and a gate counts them.
 */
async function seedRefusedWorkflowUpdate(cwd: string): Promise<{
  readonly locations: ReturnType<typeof locationsFor>;
  readonly foreignPath: string;
  readonly foreignBytes: string;
}> {
  const locations = locationsFor("project", cwd);
  const { marketplaceRoot, manifestPath } = await seedInstalledWorkflowPlugin({
    cwd,
    version: "1.0.0",
    workflows: [{ sourceName: "greet", body: GREET_VERSION_A_SOURCE }],
  });
  await writeWorkflowScripts(marketplaceRoot, "hello", [
    { sourceName: "greet", body: GREET_VERSION_A_SOURCE },
    { sourceName: "wave" },
  ]);
  await rewriteManifest(manifestPath, "mp", { hello: { version: "2.10.0" } });
  const foreignPath = path.join(locations.workflowsSavedDir, "hello:wave.json");
  const foreignBytes = '{"name":"hello:wave","script":"// hand-saved by the user\\n"}';
  await writeFile(foreignPath, foreignBytes, "utf8");
  return { locations, foreignPath, foreignBytes };
}

test("CR-03: a refused workflows commit leaves the foreign file and restores the previous envelope", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-refused-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const { locations, foreignPath, foreignBytes } = await seedRefusedWorkflowUpdate(cwd);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.equal(outcome.partition, "failed");
      assert.equal(
        await readFile(foreignPath, "utf8"),
        foreignBytes,
        "the refusal must leave the user's own saved workflow byte-for-byte",
      );
      // The plugin's own previous envelope was displaced and put back.
      assert.deepEqual(await readEnvelope(locations.workflowsSavedDir, "hello:greet"), {
        name: "hello:greet",
        description: "does greet",
        script: GREET_VERSION_A_SOURCE,
      });
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CR-01: the intent-mark union omits a name whose target holds foreign content", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-foreign-union-");
    const previousCwd = process.cwd();
    let unionDuringWindow: string[] | undefined;
    try {
      // arrange -- the same refusal vehicle, read at the ONE moment that
      // matters for this invariant: what a crash would leave on disk.
      const { foreignPath, foreignBytes } = await seedRefusedWorkflowUpdate(cwd);
      const stateWatch = observeStateTransition(
        (state) =>
          state.marketplaces["mp"]?.plugins["hello"]?.compatibility.notes.includes(
            "update-in-progress",
          ) === true,
        (state) => {
          unionDuringWindow = [
            ...(state.marketplaces["mp"]?.plugins["hello"]?.resources.workflows ?? []),
          ];
        },
      );
      process.chdir(cwd);

      // act
      await stateWatch.updateSinglePlugin("hello", "mp", "project");

      // assert -- the PERSISTED record during the intent-mark window, not the
      // narrowed one finalize writes afterwards. `hello:wave` names the user's
      // own file, and the record is the only ownership claim an unstage reads:
      // a name that lands here survives a crash in this window with nothing
      // left to re-narrow it, and the next uninstall unlinks it by fiat.
      assert.equal(stateWatch.fired(), true);
      assert.deepEqual(unionDuringWindow, ["hello:greet"]);
      // `hello:greet` proves the omission is the ownership probe and not a
      // union that stopped widening: it is the plugin's own previous name, so
      // its occupied target is owned and stays recorded.
      assert.equal(await readFile(foreignPath, "utf8"), foreignBytes);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── WR-03: one reachability case per widened `workflows` failure slot ────────
//
// Three closed sets already carry a `workflows` member that this verb could not
// produce. Each case below drives a REAL workflows failure through the update
// verb and observes ONE of them, on a value the production code produced. A
// single end-to-end case would prove only the slot it happens to touch and
// leave the other two inferred, which is the state these cases exist to end.

test("WR-03: a workflows failure reaches the update ledger's failed-phase set", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-slot-ledger-");
    const previousCwd = process.cwd();
    try {
      // arrange
      const { locations } = await seedRefusedWorkflowUpdate(cwd);
      process.chdir(cwd);

      // act
      await updateSinglePlugin("hello", "mp", "project");

      // assert -- the PERSISTED record is the observation. The finalize window
      // builds its failed-phase set by filtering the reported phases through
      // the ledger's own phase tuple, so a tuple without the `workflows` member
      // would drop this failure, take the success arm, and record the PREPARED
      // pair ["hello:greet", "hello:wave"] -- naming the foreign file. The
      // pre-update inventory alone is what the failure arm produces, and only
      // the failure arm can produce it.
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.deepEqual(record?.resources.workflows, ["hello:greet"]);
      // The other bridges still committed and still wrote their own inventories,
      // so the narrowing above is the per-phase gate firing rather than a whole
      // finalize that never ran.
      assert.equal((record?.resources.skills ?? []).length > 0, true);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: a workflows failure reaches the update outcome's per-phase failure list", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-slot-outcome-");
    const previousCwd = process.cwd();
    try {
      // arrange
      await seedRefusedWorkflowUpdate(cwd);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert -- the RETURNED outcome is the observation. `phaseFailures` is
      // typed by the shared orchestrator vocabulary, so a `workflows` entry
      // arriving here is that union's member being produced rather than
      // declared.
      assert.equal(outcome.partition, "failed");
      const phases = (outcome.phaseFailures ?? []).map((failure) => failure.phase);
      assert.deepEqual(phases, ["workflows"], JSON.stringify(outcome.phaseFailures));
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: a workflows failure reaches the rendered rollback-partial row", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-workflows-slot-row-");
    try {
      // arrange
      await seedRefusedWorkflowUpdate(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert -- the RENDERED bytes are the observation. The direct path hands
      // the renderer the typed per-phase failures verbatim, so the phase member
      // on the shared failure interface is what puts this line on screen.
      const body = notifications.map((n) => n.message).join("\n");
      assert.match(body, /\{rollback partial\}/, `no aggregate row in:\n${body}`);
      assert.match(
        body,
        /\[workflows\] \(rollback failed\)/,
        `the failing bridge must be named on its own child row in:\n${body}`,
      );
      assert.match(
        body,
        /Run \/claude:plugin reinstall hello@mp to repair it\./,
        `a phase-3 aggregate must carry the recovery hint in:\n${body}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("owns plugin update flow composition", () => {
  // arrange
  const operations = createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );

  // act and assert
  assert.strictEqual(typeof operations.updatePlugins, "function");
  assert.strictEqual(typeof operations.beginPluginUpdateRun, "function");
  assert.strictEqual(typeof operations.beginPluginUpdateRun(), "function");
  assert.strictEqual(typeof operations.convergePlugin, "function");
});

test("UPR-04: routes a not-installed preflight failure through the flow owner", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-flow-preflight-");
    const previousCwd = process.cwd();
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { present: { version: "1.0.0" } },
      });
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );
      process.chdir(cwd);

      // act
      const outcome = await operations.beginPluginUpdateRun()("present", "mp", "project");

      // assert
      assert.strictEqual(outcome.partition, "failed");
      assert.strictEqual(outcome.name, "present");
      assert.deepStrictEqual(outcome.reasons, ["not installed"]);
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PUP-6 happy: flow composes preflight, swap, state, tree, and notification", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-flow-success-");
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: {
            version: "1.0.1",
            hasSkill: true,
            hasCommand: true,
            hasAgent: true,
            hasMcp: true,
          },
        },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );

      // act
      await operations.updatePlugins({
        ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      assert.strictEqual(record.version, "1.0.1");
      assert.deepStrictEqual(record.resources.skills, ["hello-tool"]);
      assert.deepStrictEqual(record.resources.prompts, ["hello:deploy"]);
      assert.deepStrictEqual(record.resources.agents, ["pi-claude-marketplace-hello-bot"]);
      assert.deepStrictEqual(record.resources.mcpServers, ["server1"]);
      assert.strictEqual(record.compatibility.installable, true);
      assert.strictEqual(record.compatibility.notes.includes("update-in-progress"), false);
      assert.ok(
        (await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"))
          .length > 0,
      );
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n" +
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-subagents, requires pi-mcp-adapter}\n\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
      ]);
      assert.ok(seeded.marketplaceRoot.length > 0);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-06: a disabled plugin MCP server stays disabled through update", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile06-disabled-");
    try {
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: false, omitPluginJsonVersion: true },
        },
      });
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { server1: { command: "node", args: ["v1.js"] } } }),
      );
      const seed = makeCtx();
      await createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      )({
        ctx: seed.ctx,
        run: seed.run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const installed = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
        mcpServers: Record<string, Record<string, unknown>>;
      };
      installed.mcpServers.plugin_hello_server1_ = {
        ...installed.mcpServers.plugin_hello_server1_,
        disabled: true,
      };
      await writeFile(locations.mcpAdapterJsonPath, `${JSON.stringify(installed, null, 2)}\n`);
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { server1: { command: "deno", args: ["v2.js"] } } }),
      );
      await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.1" } });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.strictEqual(record?.version, "1.0.1");
      assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")), {
        mcpServers: {
          plugin_hello_server1_: {
            command: "deno",
            args: ["v2.js"],
            env: {
              CLAUDE_PLUGIN_ROOT: pluginRoot,
              CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            },
            directTools: "search",
            toolPrefix: "mcp",
            disabled: true,
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ANAME-06: update writes the new version's description and timeout", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-aname06-");
    try {
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
      const pluginJsonPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      const mcpJsonPath = path.join(pluginRoot, ".mcp.json");
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: false, omitPluginJsonVersion: true },
        },
      });
      await writeFile(pluginJsonPath, JSON.stringify({ name: "hello", description: "Old" }));
      await writeFile(
        mcpJsonPath,
        JSON.stringify({ mcpServers: { api: { type: "http", url: "https://api.example/mcp" } } }),
      );
      const seed = makeCtx();
      await createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      )({
        ctx: seed.ctx,
        run: seed.run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      await writeFile(pluginJsonPath, JSON.stringify({ name: "hello", description: "New" }));
      await writeFile(
        mcpJsonPath,
        JSON.stringify({
          mcpServers: { api: { type: "http", url: "https://api.example/mcp", timeout: 60000 } },
        }),
      );
      await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.1" } });
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.strictEqual(record?.version, "1.0.1");
      assert.equal(
        await readFile(locations.mcpAdapterJsonPath, "utf8"),
        `{
  "mcpServers": {
    "plugin_hello_api_": {
      "url": "https://api.example/mcp",
      "requestTimeoutMs": 60000,
      "description": "New",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "hello",
        "marketplace": "mp",
        "pluginSetFields": [
          "requestTimeoutMs"
        ]
      }
    }
  }
}
`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ANAME-07: a plugin-set timeout wins over a carried override and a dropped one leaves no stale value", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-aname07-");
    try {
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
      const mcpJsonPath = path.join(pluginRoot, ".mcp.json");
      const { manifestPath } = await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.0", hasSkill: false, omitPluginJsonVersion: true },
        },
      });
      await writeFile(
        mcpJsonPath,
        JSON.stringify({
          mcpServers: { api: { type: "http", url: "https://api.example/mcp", timeout: 120000 } },
        }),
      );
      const seed = makeCtx();
      await createInstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      )({
        ctx: seed.ctx,
        run: seed.run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const installed = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
        mcpServers: Record<string, Record<string, unknown>>;
      };
      installed.mcpServers.plugin_hello_api_ = {
        ...installed.mcpServers.plugin_hello_api_,
        requestTimeoutMs: 5000,
        disabled: true,
      };
      await writeFile(locations.mcpAdapterJsonPath, `${JSON.stringify(installed, null, 2)}\n`);
      await writeFile(
        mcpJsonPath,
        JSON.stringify({
          mcpServers: { api: { type: "http", url: "https://api.example/mcp", timeout: 90000 } },
        }),
      );
      await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.1" } });
      const target = { kind: "plugin", plugin: "hello", marketplace: "mp" } as const;
      const { ctx, run } = makeCtx();

      // act
      await updatePlugins({ ctx, run, scope: "project", cwd, target });
      const afterTimeoutChange: unknown = JSON.parse(
        await readFile(locations.mcpAdapterJsonPath, "utf8"),
      );
      await writeFile(
        mcpJsonPath,
        JSON.stringify({ mcpServers: { api: { type: "http", url: "https://api.example/mcp" } } }),
      );
      await rewriteManifest(manifestPath, "mp", { hello: { version: "1.0.2" } });
      await updatePlugins({ ctx, run, scope: "project", cwd, target });
      const afterTimeoutDrop: unknown = JSON.parse(
        await readFile(locations.mcpAdapterJsonPath, "utf8"),
      );

      // assert
      assert.deepStrictEqual(afterTimeoutChange, {
        mcpServers: {
          plugin_hello_api_: {
            url: "https://api.example/mcp",
            requestTimeoutMs: 90000,
            directTools: "search",
            toolPrefix: "mcp",
            disabled: true,
            _piClaudeMarketplace: {
              plugin: "hello",
              marketplace: "mp",
              pluginSetFields: ["requestTimeoutMs"],
            },
          },
        },
      });
      assert.deepStrictEqual(afterTimeoutDrop, {
        mcpServers: {
          plugin_hello_api_: {
            url: "https://api.example/mcp",
            directTools: "search",
            toolPrefix: "mcp",
            disabled: true,
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.strictEqual(record?.version, "1.0.2");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** AFILE-04: the exact comments-dropped notice for the project-scope adapter file. */
const PROJECT_COMMENTS_DROPPED_NOTICE: NotifyRecord = {
  severity: "warning",
  message:
    "MCP config comments removed.\n\nThe project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
};

/** AFILE-04: a project-scope mcp-adapter.json that holds a `//` comment. */
const COMMENTED_ADAPTER_TEXT =
  '{\n  // mine\n  "mcpServers": { "mine": { "command": "my-server" } }\n}\n';

/** AFILE-04: seed `hello` 1.0.0 -> 1.0.1 with one MCP server over the given adapter file. */
async function seedMcpUpdate(
  cwd: string,
  adapterText: string,
): Promise<{ readonly locations: ReturnType<typeof locationsFor>; readonly pluginRoot: string }> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "1.0.1", hasMcp: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const locations = locationsFor("project", cwd);
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, adapterText);
  return { locations, pluginRoot: path.join(marketplaceRoot, "plugins", "hello") };
}

test("AFILE-04: update over a commented mcp-adapter.json shows the comments-removed notice after the cascade", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile04-");
    try {
      await seedMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n" +
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-mcp-adapter}\n\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: an update that fails after its MCP commit still reports the removed comments", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile04-failed-");
    try {
      const { locations, pluginRoot } = await seedMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      await mkdir(path.join(pluginRoot, "workflows"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, "workflows", "greet.js"),
        'export const meta = { name: "greet", description: "does greet" };\n',
      );
      const foreignPath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      await mkdir(locations.workflowsSavedDir, { recursive: true });
      await writeFile(foreignPath, "{}");
      const refusal = `Cannot replace workflow target with non-previous content at ${foreignPath}`;
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● mp [project]\n" +
            "  ⊘ hello v1.0.0 → v1.0.1 (failed) {rollback partial}\n" +
            `    cause: Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it. -> ${refusal}\n` +
            "    [workflows] (rollback failed)\n" +
            `      cause: ${refusal}`,
          severity: "error",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-PL1-23 / WRN-06: a direct update whose settle refused shows the notices of the dependencies it installed after the cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-refused-settle-notices-");
    try {
      // arrange
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, run, notifications } = makeCtx();
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        undefined,
        {},
        () =>
          Promise.resolve({
            kind: "refused",
            rows: [
              {
                status: "installed",
                name: "zcore@mp",
                dependencies: [],
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
            cause: new Error("zzz refused"),
            mcpConfigNotices: [
              { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
            ],
          }),
      );

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: [
            "A plugin operation has failed.",
            "",
            "● mp [project]",
            "  ⊘ hello v1.0.0 (failed) {dependency failed}",
            "  ● zcore@mp v1.0.0 (installed)",
            "",
            "/reload to pick up changes",
          ].join("\n"),
          severity: "error",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: the cascade update entry returns the notice without notifying", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile04-cascade-");
    const previousCwd = process.cwd();
    try {
      await seedMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      process.chdir(cwd);

      // act
      const outcome = await updateSinglePlugin("hello", "mp", "project");

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        resourcesChanged: true,
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.1",
        stagedAgentNames: [],
        stagedMcpServerNames: ["server1"],
        declaresAgents: false,
        declaresMcp: true,
        constraint: undefined,
        declaresWorkflows: false,
        mcpConfigNotices: [
          { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
        ],
      });
    } finally {
      process.chdir(previousCwd);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const STAGING_VARIABLE_NOTICE: NotifyRecord = {
  severity: "warning",
  message:
    'MCP server variables not set.\n\nServer "plugin_hello_server1_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_SET_FOR_STAGING.',
};

for (const { label, env, notices } of [
  { label: "sets", env: { PI_CM_SET_FOR_STAGING: "1" }, notices: [] },
  { label: "lacks", env: {}, notices: [STAGING_VARIABLE_NOTICE] },
] as const) {
  test(`D-08-06: an update whose environment ${label} a variable stages with that environment`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await createCaseDir(`update-env-${label}-`);
      try {
        const { pluginRoot } = await seedMcpUpdate(cwd, '{ "mcpServers": {} }\n');
        await writeFile(
          path.join(pluginRoot, ".mcp.json"),
          JSON.stringify({
            mcpServers: { server1: { command: "node", args: ["${PI_CM_SET_FOR_STAGING}"] } },
          }),
        );
        const operations = createPluginUpdateOperations(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
          undefined,
          env,
        );
        const { ctx, run, notifications } = makeCtx();

        // act
        await operations.updatePlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        // assert
        assert.deepStrictEqual(notifications, [
          {
            message:
              "A plugin operation needs attention.\n\n" +
              "● mp [project]\n" +
              "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-mcp-adapter}\n\n" +
              "/reload to pick up changes",
            severity: "warning",
          },
          ...notices,
        ]);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("AFILE-02: updating a plugin with no MCP servers over an unparseable mcp-adapter.json leaves it unchanged and says so", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile02-unparseable-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
      await writeFile(locations.mcpAdapterJsonPath, "{ not json");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n\n/reload to pick up changes",
        },
        {
          message:
            "MCP config left unchanged.\n\nThe project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
          severity: "warning",
        },
      ]);
      assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{ not json");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * AFILE-04: binds update operations whose next locked state load throws once a
 * save has recorded `hello` at `helloVersion`, so the target after `hello`
 * fails at its intent mark, after its candidate.
 */
function failLoadsAfterHelloUpdate(helloVersion: string): UpdatePluginsFn {
  let helloUpdated = false;
  return createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
    {
      loadState: async (extensionRoot) => {
        if (helloUpdated) {
          throw new Error("state read failed");
        }

        return loadState(extensionRoot);
      },
      saveState: async (extensionRoot, state) => {
        await saveState(extensionRoot, state);
        helloUpdated ||= state.marketplaces["mp"]?.plugins["hello"]?.version === helloVersion;
      },
    },
  ).updatePlugins;
}

test("AFILE-04 / CR-01: a bulk update that aborts on a later plugin's failure still reports the earlier update and the comments it removed", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile04-later-throw-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          hello: { version: "1.0.1", hasMcp: true },
          zzz: { version: "1.0.1" },
        },
        installedVersions: { hello: "1.0.0", zzz: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      await writeFile(locations.mcpAdapterJsonPath, COMMENTED_ADAPTER_TEXT);
      const updateAll = failLoadsAfterHelloUpdate("1.0.1");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updateAll({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● mp [project]\n" +
            "  ⊘ zzz v1.0.0 → v1.0.1 (failed) {unreadable manifest}\n" +
            "    cause: state read failed\n\n" +
            "Plugin update: 1 failure",
          severity: "error",
        },
        {
          message:
            "A plugin operation needs attention.\n\n" +
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-mcp-adapter}\n\n" +
            "Plugin update: 1 warning, 1 updated\n\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UPR-03: a later target's failure in a bulk update names its own move, not the earlier target's", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-bulk-own-move-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0" }, zzz: { version: "1.0.1" } },
        installedVersions: { hello: "1.0.0", zzz: "1.0.0" },
      });
      const updateAll = failLoadsAfterHelloUpdate("2.0.0");
      const { ctx, run, notifications } = makeCtx();

      // act
      await updateAll({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● mp [project]\n" +
            "  ⊘ zzz v1.0.0 → v1.0.1 (failed) {unreadable manifest}\n" +
            "    cause: state read failed\n\n" +
            "Plugin update: 1 failure",
          severity: "error",
        },
        {
          message:
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v2.0.0 (updated)\n\n" +
            "Plugin update: 1 updated\n\n" +
            "/reload to pick up changes",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04 / CR-01: a bulk update that aborts on a later marketplace sync still reports the earlier update and the comments it removed", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-afile04-later-sync-");
    try {
      const { locations } = await seedMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      const cloneDir = await locations.sourceCloneDir("zzz");
      await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
      const state = await loadState(locations.extensionRoot);
      state.marketplaces["zzz"] = {
        name: "zzz",
        scope: "project",
        source: githubSource("https://github.com/test/repo#main"),
        addedFromCwd: cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: { hello: makePluginRecord("1.0.0") },
      };
      await saveState(locations.extensionRoot, state);
      const { gitOps } = createGitOps({
        fetchThrows: new Error("network: connection refused"),
        remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000001" },
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await updatePlugins({ ctx, run, scope: "project", cwd, target: { kind: "all" }, gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● zzz [project]\n" +
            "  ⊘ zzz (failed) {network error}\n" +
            "    cause: network: connection refused\n\n" +
            "Plugin update: 1 failure",
          severity: "error",
        },
        {
          message:
            "A plugin operation needs attention.\n\n" +
            "● mp [project]\n" +
            "  ● hello v1.0.0 → v1.0.1 (updated) {requires pi-mcp-adapter}\n\n" +
            "Plugin update: 1 warning, 1 updated\n\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─── D-26: the converge entry `apply` drives ────────────────────────────────

function convergeOperations(stateTransaction?: Parameters<typeof createPluginUpdateOperations>[2]) {
  return createPluginUpdateOperations(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
    stateTransaction,
  );
}

test("D-26: convergePlugin moves a path-source plugin to the catalog version in the target's cwd", async () => {
  await withHermeticHome(async () => {
    // arrange -- the process cwd is not the project, so only the target's own
    // `cwd` can locate the project scope.
    const cwd = await createCaseDir("update-converge-move-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      assert.notStrictEqual(process.cwd(), cwd);

      // act
      const outcome = await convergeOperations().convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        resourcesChanged: true,
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
      const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "1.1.0");
      assert.ok(await pathExists(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md")));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("APPLY1-01 / WR-3: convergePlugin collects clones through the target's collector when it names one", async () => {
  await withHermeticHome(async () => {
    // arrange -- the record names a commit the path-source candidate drops, so
    // the move asks for a clone collection.
    const cwd = await createCaseDir("update-converge-collector-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const seeded = await loadState(locations.extensionRoot);
      const hello = seeded.marketplaces.mp?.plugins.hello;
      assert.ok(hello !== undefined);
      hello.resolvedSha = "a".repeat(40);
      hello.enabled = false;
      await saveState(locations.extensionRoot, seeded);
      const collected: string[] = [];

      // act
      await convergeOperations().convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
        cleanupClones: (target) => {
          collected.push(target.pluginClonesDir);
          return Promise.resolve();
        },
      });

      // assert
      assert.deepStrictEqual(collected, [locations.pluginClonesDir]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-26: convergePlugin answers a move at the recorded revision as unchanged and writes nothing", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-converge-same-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const before = await readFile(locations.stateJsonPath, "utf8");

      // act
      const outcome = await convergeOperations().convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "unchanged",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
      assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), before);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10 / D-25: convergePlugin with rematerialize re-materializes the recorded revision", async () => {
  await withHermeticHome(async () => {
    // arrange -- the catalog offers the recorded version, and a skill the
    // record names is missing on disk.
    const cwd = await createCaseDir("update-converge-rematerialize-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const skillFile = path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md");
      await rm(path.join(locations.skillsTargetDir, "hello-tool"), {
        recursive: true,
        force: true,
      });

      // act
      const outcome = await convergeOperations().convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: true,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        resourcesChanged: true,
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
        declaresWorkflows: false,
      });
      assert.ok(await pathExists(skillFile));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { partial, expected } of [
  { partial: false, expected: "declined" },
  { partial: true, expected: "moved partially" },
] as const) {
  test(`D-26 / WCONV-01: a partially available candidate is ${expected} when the target's partial is ${String(partial)}`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await createCaseDir("update-converge-partial-");
      try {
        const marketplaceRoot = path.join(cwd, "mp-src");
        await seedPathMarketplace({
          cwd,
          marketplaceRoot,
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
          installedVersions: { hello: "1.0.0" },
        });
        await writeFile(
          path.join(marketplaceRoot, "plugins", "hello", ".lsp.json"),
          JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
        );

        // act
        const outcome = await convergeOperations().convergePlugin({
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          partial,
          rematerialize: false,
        });

        // assert
        if (partial) {
          assert.strictEqual(outcome.partition, "updated");
          assert.deepStrictEqual(
            outcome.partition === "updated" ? outcome.partialDegrade : undefined,
            { kinds: ["lspServers"], newlyDegraded: true },
          );
        } else {
          assert.deepStrictEqual(outcome, {
            partition: "skipped",
            name: "hello",
            fromVersion: "1.0.0",
            notes: ['Plugin "hello" is no longer installable: contains lspServers'],
            reasons: ["lsp"],
            partialUpgradable: true,
            declaresAgents: false,
            declaresMcp: false,
            declaresWorkflows: false,
          });
        }
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

for (const { rematerialize, offered } of [
  { rematerialize: false, offered: "2.0.0" },
  { rematerialize: true, offered: "1.0.0" },
] as const) {
  test(`D-26 / T-29-29 / T-29-35: convergePlugin keeps an agent file a user edited and fails the move when rematerialize is ${String(rematerialize)}`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await createCaseDir("update-converge-edited-agent-");
      try {
        const locations = locationsFor("project", cwd);
        const marketplaceRoot = path.join(cwd, "mp-src");
        await seedPathMarketplace({
          cwd,
          marketplaceRoot,
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: offered, hasSkill: false, hasAgent: true } },
          installedVersions: { hello: "1.0.0" },
        });
        const target = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
        const editedBytes = "---\nname: bot\n---\nEdited by hand.\n";
        await mkdir(locations.agentsDir, { recursive: true });
        await writeFile(target, editedBytes);
        await writeFile(
          locations.agentsIndexPath,
          JSON.stringify({
            schemaVersion: 1,
            agents: [
              {
                plugin: "hello",
                marketplace: "mp",
                sourceAgent: "bot",
                generatedName: "pi-claude-marketplace-hello-bot",
                sourcePath: path.join(marketplaceRoot, "plugins", "hello", "agents", "bot.md"),
                targetPath: target,
                sourceHash: "a".repeat(64),
                droppedFields: [],
                droppedTools: [],
                warnings: [],
              },
            ],
          }),
        );
        const state = await loadState(locations.extensionRoot);
        const record = state.marketplaces.mp?.plugins.hello;
        assert.ok(record !== undefined);
        record.resources = {
          ...record.resources,
          skills: [],
          agents: ["pi-claude-marketplace-hello-bot"],
        };
        await saveState(locations.extensionRoot, state);
        const stateBefore = await readFile(locations.stateJsonPath, "utf8");

        // act
        const outcome = await convergeOperations().convergePlugin({
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          partial: false,
          rematerialize,
        });

        // assert
        assert.strictEqual(outcome.partition, "failed");
        assert.strictEqual(await readFile(target, "utf8"), editedBytes);
        assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("D-26 / PUP-9: a throw inside convergePlugin becomes a failed outcome naming the attempted move", async () => {
  await withHermeticHome(async () => {
    // arrange -- the swap's intent mark is the first save, after the candidate.
    const cwd = await createCaseDir("update-converge-throw-");
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      const operations = convergeOperations({
        loadState,
        saveState: () => Promise.reject(denied),
      });

      // act
      const outcome = await operations.convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.ok(outcome.partition === "failed");
      const { cause, ...failure } = outcome;
      assert.deepStrictEqual(failure, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        notes: ["EACCES: permission denied\n\ncause: EACCES: permission denied"],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["permission denied"],
      });
      // D-PL7-12: an errno reason carries its error as the row's cause.
      assert.strictEqual(cause, denied);
      const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GLK-02 / D-PL7-12: a convergePlugin swap that fails with EISDIR reads unreadable and carries its cause", async () => {
  await withHermeticHome(async () => {
    // arrange -- the swap's intent mark is the first save, after the candidate.
    const cwd = await createCaseDir("update-converge-eisdir-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const blocked = Object.assign(new Error("EISDIR: illegal operation on a directory, read"), {
        code: "EISDIR",
      });
      const operations = convergeOperations({
        loadState,
        saveState: () => Promise.reject(blocked),
      });

      // act
      const outcome = await operations.convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.ok(outcome.partition === "failed");
      const { cause, ...failure } = outcome;
      assert.deepStrictEqual(failure, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        notes: [`${blocked.message}\n\ncause: ${blocked.message}`],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["unreadable"],
      });
      assert.strictEqual(cause, blocked);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GLK-02: a convergePlugin swap that fails with a missing marketplace reads not found, as the direct path does", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-converge-mp-missing-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const missing = new MarketplaceNotFoundError("mp", ["project"]);
      const operations = convergeOperations({
        loadState,
        saveState: () => Promise.reject(missing),
      });

      // act
      const outcome = await operations.convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        notes: [`${missing.message}\n\ncause: ${missing.message}`],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        reasons: ["not found"],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GLK-02 / D-13: a direct update whose staging error wraps EACCES reads permission denied", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-direct-staging-denied-");
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      const staging = new BridgeStagingError("could not stage hello.md", { cause: denied });
      const operations = convergeOperations({
        loadState,
        saveState: () => Promise.reject(staging),
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello v1.0.0 → v1.1.0 (failed) {permission denied}\n    cause: could not stage hello.md -> EACCES: permission denied",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-13: a source file convergePlugin cannot read fails the move as permission denied", async () => {
  await withHermeticHome(async () => {
    // arrange -- the commands bridge names the file and carries the EACCES as
    // its cause.
    const cwd = await createCaseDir("update-converge-unreadable-");
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedPathMarketplace({
        cwd,
        marketplaceRoot,
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.1.0", hasSkill: true, hasCommand: true } },
        installedVersions: { hello: "1.0.0" },
      });
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        throw new Error("an unreadable file cannot deny root; run this suite as a non-root user");
      }

      const unreadable = path.join(marketplaceRoot, "plugins", "hello", "commands", "deploy.md");
      await chmod(unreadable, 0o000);

      // act
      const outcome = await convergeOperations().convergePlugin({
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        cwd,
        partial: false,
        rematerialize: false,
      });

      // assert
      assert.strictEqual(outcome.partition, "failed");
      assert.deepStrictEqual(outcome.reasons, ["permission denied"]);
    } finally {
      // An unreadable file still unlinks, so the tree removal needs no restore.
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-03: convergePlugin rethrows an invalid base", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await createCaseDir("update-converge-invalid-base-");
    t.after(() => rm(cwd, { recursive: true, force: true }));
    await seedGitUpdateMarketplace({
      cwd,
      cloneUrl: "https://github.com/org/repo",
      entrySource: { source: "github", repo: "org/repo" },
      recordedSha: SHA_OLD,
      versionTag: "9.9.9",
    });
    setGitHubBaseUrl(t, "http://mirror.example");

    // act & assert
    await assert.rejects(
      () =>
        convergeOperations().convergePlugin({
          plugin: "gp",
          marketplace: "mp",
          scope: "project",
          cwd,
          partial: false,
          rematerialize: false,
        }),
      (error: unknown) => {
        assert.deepStrictEqual(
          error,
          new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
        );
        return true;
      },
    );
  });
});

test("UPD-DEP-D1: a named update settles the new version's dependencies in the command's context and reports their rows", async () => {
  await withHermeticHome(async () => {
    const cwd = await createCaseDir("update-settles-dependencies-");
    try {
      // arrange
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const { ctx, run, notifications } = makeCtx();
      const settled: unknown[] = [];
      const operations = createPluginUpdateOperations(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
        undefined,
        {},
        (args, prepared, notification) => {
          settled.push([
            args.plugin,
            prepared.toVersion,
            notification.ctx === ctx,
            notification.run === run,
          ]);
          return Promise.resolve({
            kind: "settled",
            rows: [
              {
                status: "installed",
                name: "zcore@mp",
                dependencies: [],
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
            stagingDiagnostics: [
              {
                plugin: "zcore",
                scope: "project",
                verb: "installed",
                warnings: [
                  {
                    kind: "discovery",
                    message: "dependency package install failed",
                  },
                ],
              },
            ],
          });
        },
      );

      // act
      await operations.updatePlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 → v1.0.1 (updated)\n  ● zcore@mp v1.0.0 (installed)\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "zcore" [project] installed; 1 declared component has a note.\n\ndependency package install failed',
          severity: "warning",
        },
      ]);
      assert.deepStrictEqual(settled, [["hello", "1.0.1", true, true]]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { label, notified, expected } of [
  { label: "with the command's context settles", notified: true, expected: ["hello"] },
  { label: "without a context settles no", notified: false, expected: [] },
]) {
  test(`UPD-DEP-D1: an autoupdate run ${label} dependencies`, async () => {
    await withHermeticHome(async () => {
      const cwd = await createCaseDir("autoupdate-settles-dependencies-");
      const previousCwd = process.cwd();
      try {
        // arrange
        await seedPathMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          marketplaceName: "mp",
          manifestPlugins: { hello: { version: "1.0.1", hasSkill: true } },
          installedVersions: { hello: "1.0.0" },
        });
        process.chdir(cwd);
        const { ctx, run } = makeCtx();
        const settled: string[] = [];
        const operations = createPluginUpdateOperations(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
          undefined,
          {},
          (args) => {
            settled.push(args.plugin);
            return Promise.resolve({ kind: "settled", rows: [] });
          },
        );
        const updateOne = operations.beginPluginUpdateRun(notified ? { ctx, run } : undefined);

        // act
        const outcome = await updateOne("hello", "mp", "project");

        // assert
        assert.strictEqual(outcome.partition, "updated");
        assert.deepStrictEqual(settled, expected);
      } finally {
        process.chdir(previousCwd);
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}
