// Test support for the install-flow source pairs.

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  createInstallMissingDependency as createPublicInstallMissingDependency,
  createInstallPlugin as createPublicInstallPlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { runPhases } from "../../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithSoftDeps } from "../../shared/notification-run-seeds.ts";

import { materializeCommitCopyWith } from "./mirror-checkout.ts";

import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { InstallCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts";
import type { InstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts";
import type { InstallTransaction } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import type {
  NotificationContext,
  SoftDepStatus,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";

export type InstallOperation = ReturnType<typeof createPublicInstallPlugin>;
export type InstallMissingDependencyOperation = ReturnType<
  typeof createPublicInstallMissingDependency
>;

const REAL_INSTALL_TRANSACTION: InstallTransaction = {
  runPhases: (...args) => runPhases(...args),
  withLockedStateTransaction: (...args) => withLockedStateTransaction(...args),
};

export function createInstallPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: NodeJS.ProcessEnv = process.env,
): InstallOperation {
  return createPublicInstallPlugin(transaction, hooksRouting, completionCache, env);
}

export function createInstallMissingDependency(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: NodeJS.ProcessEnv = process.env,
): InstallMissingDependencyOperation {
  return createPublicInstallMissingDependency(transaction, hooksRouting, completionCache, env);
}

export interface InstallTestOwner {
  readonly completionCache: CompletionCache;
  readonly hooksRouting: InstallHooksRouting;
  readonly hooksRuntime: HooksRuntime;
  readonly installPlugin: InstallOperation;
  /** MISS-01: the reload-only missing-dependency entry point beside `installPlugin`. */
  readonly installMissingDependency: InstallMissingDependencyOperation;
  readonly transaction: InstallTransaction;
  readonly transactionControl: InstallTransactionControl;
}

export interface InstallTransactionControl {
  runPhases: typeof runPhases;
}

export interface NotifyRecord {
  message: string;
  severity?: string;
}

export function makeCtx(loaded?: Partial<SoftDepStatus>): {
  ctx: NotificationContext;
  run: NotificationRun;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
    ...loaded,
  });
  return { ctx, run, notifications };
}

export async function withHermeticHome<T>(fn: (owner: InstallTestOwner) => Promise<T>): Promise<T> {
  return withHermeticEnvironment("install-", () => {
    const hooksRuntime = createHooksRuntime();
    const hooksRouting = createHooksRouting(hooksRuntime, { readHooksJson });
    const completionCache = createCompletionCache();
    const transactionControl: InstallTransactionControl = { runPhases };
    const transaction: InstallTransaction = {
      runPhases: (phases, ctx) => transactionControl.runPhases(phases, ctx),
      withLockedStateTransaction: REAL_INSTALL_TRANSACTION.withLockedStateTransaction,
    };
    return fn({
      completionCache,
      hooksRouting,
      hooksRuntime,
      installPlugin: createInstallPlugin(transaction, hooksRouting, completionCache),
      installMissingDependency: createInstallMissingDependency(
        transaction,
        hooksRouting,
        completionCache,
      ),
      transaction,
      transactionControl,
    });
  });
}

const INSTALL_REMOTE_URLS = [
  "https://example.com/org/repo",
  "https://example.com/org/repo.git",
  "https://example.com/org/mono",
  "https://github.com/org/repo.git",
  "https://github.com/org/private.git",
  "https://gitlab.com/o/r",
  "https://gitlab.example.com/o/private",
  "https://gitlab.example.com/o/r",
] as const;

export function createGitOps(options: {
  readonly fixtureSourceDir: string;
  readonly cloneThrows?: Error;
  readonly head?: string;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteRefs?: Readonly<Record<string, string>>;
  readonly remoteResolveMap?: Readonly<Record<string, string>>;
}): {
  readonly gitOps: ReturnType<typeof createGitOpsFake>["gitOps"];
  readonly state: {
    readonly cloneCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"];
    readonly checkoutCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["checkout"];
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
    allowedRemoteUrls: INSTALL_REMOTE_URLS,
    cloneFixture: { boundary: "local", sourceDir: options.fixtureSourceDir },
    ...(options.cloneThrows !== undefined && { cloneError: options.cloneThrows }),
    ...(options.head !== undefined && { initialOid: options.head, remoteHead: options.head }),
    ...(options.localRefs !== undefined && { localRefs: options.localRefs }),
    ...(Object.keys(remoteRefs).length > 0 && { remoteRefs }),
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
      checkoutCalls: fake.state.calls.checkout,
      resolveRemoteRefCalls: fake.state.calls.resolveRemoteRef,
    },
  };
}

/**
 * Bind the clone-cache seam entrypoints to a mock gitOps so install's
 * git-source path runs without touching the network.
 */
export function seamWith(gitOps: GitOps): InstallCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
    materializePluginCommitCopy: (args) => materializeCommitCopyWith(gitOps, args),
  };
}

export const INSTALL_DEVICE_CODE = {
  device_code: "MOCK_DEVICE_CODE",
  expires_in: 900,
  interval: 0,
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
} as const;

export interface CatalogPlugin {
  readonly version: string;
  readonly dependencies?: readonly string[];
  readonly mcp?: true;
  readonly experimental?: object;
}

export async function publishCatalog(
  marketplaceRoot: string,
  plugins: Readonly<Record<string, CatalogPlugin>>,
): Promise<void> {
  for (const [name, plugin] of Object.entries(plugins)) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", name);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name,
        version: plugin.version,
        ...(plugin.dependencies !== undefined && { dependencies: plugin.dependencies }),
        ...(plugin.experimental !== undefined && { experimental: plugin.experimental }),
      }),
    );
    await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
    if (plugin.mcp === true) {
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { [`${name}-server`]: { command: "node" } } }),
      );
    }
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: Object.keys(plugins).map((name) => ({ name, source: `./plugins/${name}` })),
    }),
  );
}

export async function seedCatalogScope(
  plugins: Readonly<Record<string, CatalogPlugin>>,
): Promise<{ readonly cwd: string; readonly marketplaceRoot: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), "install-upd-dep-"));
  const marketplaceRoot = path.join(cwd, "mp-src");
  await publishCatalog(marketplaceRoot, plugins);
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        plugins: {},
      },
    },
  });
  return { cwd, marketplaceRoot };
}

/** The commit the mock git host's HEAD names. */
export const INSTALL_HOST_HEAD = "3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f";

/** Offers `name` in marketplace `mp` as an unpinned URL source. */
export async function offerGitPlugin(
  marketplaceRoot: string,
  name: string,
  dependencies?: readonly string[],
): Promise<string> {
  const repository = path.join(path.dirname(marketplaceRoot), `${name}-repository`);
  await mkdir(path.join(repository, "skills", "probe"), { recursive: true });
  await writeFile(path.join(repository, "skills", "probe", "SKILL.md"), "---\nname: probe\n---\n");
  const declared = dependencies === undefined ? {} : { dependencies };
  await mkdir(path.join(repository, ".claude-plugin"));
  await writeFile(
    path.join(repository, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version: "1.0.0", ...declared }),
  );
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const catalog = JSON.parse(await readFile(manifestPath, "utf8")) as { plugins: object[] };
  catalog.plugins.push({
    name,
    source: { source: "url", url: "https://example.com/org/repo" },
    ...declared,
  });
  await writeFile(manifestPath, JSON.stringify(catalog));
  return repository;
}

/** Installs `app@mp`, counting mirror resolutions and pinned clone writes. */
export async function installAppCountingResolves(
  owner: InstallTestOwner,
  cwd: string,
  repository: string,
): Promise<{ readonly status: string; readonly mirrors: number; readonly pins: string[] }> {
  const inner = seamWith(
    createGitOps({
      fixtureSourceDir: repository,
      head: INSTALL_HOST_HEAD,
      localRefs: { "refs/heads/main": INSTALL_HOST_HEAD },
      remoteRefs: { "refs/remotes/origin/main": INSTALL_HOST_HEAD },
    }).gitOps,
  );
  let mirrors = 0;
  const pins: string[] = [];
  const { ctx, run } = makeCtx();
  const outcome = await owner.installPlugin({
    ctx,
    run,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "app",
    cloneCacheSeam: {
      ...inner,
      materializeOrRefreshPluginMirror: (args) => {
        mirrors += 1;
        return inner.materializeOrRefreshPluginMirror(args);
      },
      materializePluginClone: (args) => {
        pins.push(args.pin);
        return inner.materializePluginClone(args);
      },
    },
  });
  return { status: outcome.status, mirrors, pins };
}

/** The commit `plugin@mp`'s record names. */
export async function recordedSha(cwd: string, plugin: string): Promise<string | undefined> {
  const state = await loadState(locationsFor("project", cwd).extensionRoot);
  return state.marketplaces.mp?.plugins[plugin]?.resolvedSha;
}

/** Runs the shared git-root setup used by each side of the planning/ledger handoff. */
export async function installGitAppAfterDependencyMove(owner: InstallTestOwner): Promise<{
  readonly cwd: string;
  readonly install: Awaited<ReturnType<typeof installAppCountingResolves>>;
}> {
  const { cwd, marketplaceRoot } = await seedCatalogScope({ lib: { version: "1.2.0" } });
  const initial = makeCtx();
  await owner.installPlugin({
    ctx: initial.ctx,
    run: initial.run,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "lib",
  });
  await publishCatalog(marketplaceRoot, { lib: { version: "2.0.0" } });
  const repository = await offerGitPlugin(marketplaceRoot, "app", ["lib@^2.0.0"]);
  return { cwd, install: await installAppCountingResolves(owner, cwd, repository) };
}
