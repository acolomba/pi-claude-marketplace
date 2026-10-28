// Owner suite for orchestrators/reconcile/apply.ts.
// behavioral-composition-exception: applyReconcile
//
// D-115-03: the load-time cascade's contract is the state it leaves on disk and
// the single notification it renders, so every case drives the real install,
// uninstall, enable and disable against a case-owned temporary tree and fakes
// only the git remote. `createOfflineGitOps` allows no remote at all, so an
// unexpected clone fails immediately; that refusal, not the absence of a call,
// is the NFR-5 offline proof.
//
// IL-2 / RECON-04 are proved by sizing the notification boundary: each case
// promises the exact number of emissions it expects, so a second
// `ctx.ui.notify` call throws where it is made instead of being counted
// afterwards. A reconcile that accumulates no outcome promises zero, which is
// how the NFR-2 / A4 load-time silence contract is proved.
//
// Every expected cascade body is an authored literal built from the row grammar
// in docs/messaging-style-guide.md and the `reconcile-applied-cascade` fixtures
// in docs/output-catalog.md. No expectation calls the reconcile projection --
// that module has its own owner and is the single oracle for its own behavior.
//
// D-115-07: every outcome kind the cascade can accumulate is produced here.
//
//   invalid-block            an unparseable base config and an unparseable
//                            state file; the read pass's other rows have
//                            their owner in read-pass.test.ts
//   mp-added                 a declared marketplace absent from the record
//   mp-add-failed            a source directory that is not there, and a clone
//                            that cannot reach its remote
//   mp-removed               a recorded marketplace no longer declared
//   mp-remove-failed         a competing process that removed it first, and a
//                            scope resolution that met a half-written state file
//   mp-remove-partial        a cascade that unstages some plugins and is
//                            refused on others
//   plugin-installed         a newly declared plugin, with the degraded,
//                            orphaned-rewake and companion variants
//   plugin-install-failed    a manifest entry whose source tree is gone, an
//                            install whose dependency the marketplace does not
//                            declare, an install whose own manifest entry
//                            is missing (classification unaffected by RESV-06),
//                            and an install whose dependency's own ledger
//                            fails with a nested cause (redacted, kept intact)
//   plugin-uninstalled       a declaration deleted under a kept marketplace,
//                            and the children of a marketplace removal
//   plugin-uninstall-failed  a refused unstage, both directly and under a
//                            partial marketplace removal
//   plugin-enabled           a recorded-but-disabled plugin declared enabled
//   plugin-enable-failed     an enable whose marketplace clone is gone
//   plugin-disabled          a declaration flipped off, and an install that
//                            lands disabled by its own declared default
//   plugin-disable-failed    a refused unstage on the disable path
//   source-mismatch          all four planner causes in one cascade
//   plugin-backfilled        a promotion riding the same cascade as an install

import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { mock, verify, when } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createUninstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import {
  createApplyReconcile,
  createScopeDependencyInstall,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { buildScopeSatisfactionVerdict } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { loadConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  InvalidGitHubBaseUrlError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { HooksRouting } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { ParsedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type * as ApplyOrchestrator from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import type { ReconcileStateReader } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts";
import type {
  ApplyReconcileOptions,
  McpMigrationStep,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type {
  ScopeDependencyInstallFn,
  ScopeDependencyInstallResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Notification } from "../../edge/notification-boundary.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

// apply.ts publishes the factory and its selected-state reader contract; the
// single production composition of them lives in the extension entry point.
// Re-adding a composed value here would give the reconcile two production
// bindings. Restoring the export makes the `satisfies` resolve and turns the
// directive below into an unused one (TS2578).
// @ts-expect-error apply.ts does not expose a composed applyReconcile value
void ({} satisfies { readonly retired?: typeof ApplyOrchestrator.applyReconcile });

/**
 * The composition every case below drives: this module's own factory bound to
 * the real selected-state reader, stated at one site so each case reads as the
 * reconcile rather than as its assembly. It is the same reader the production
 * composition in the extension entry point binds.
 */
const applyReconcileWithRouting = createApplyReconcile({ loadState });

const RECORDED_AT = "2026-01-01T00:00:00.000Z";
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

interface CompositionExceptionMarker {
  readonly kind: "production" | "test";
  readonly path: string;
  readonly symbol: string;
}

/** Census the explicitly marked behavioral-composition exceptions. */
async function compositionExceptionCensus(): Promise<readonly CompositionExceptionMarker[]> {
  const markers: CompositionExceptionMarker[] = [];
  const roots = [
    { kind: "production" as const, path: "extensions/pi-claude-marketplace" },
    { kind: "test" as const, path: "test" },
  ];

  async function visit(kind: CompositionExceptionMarker["kind"], directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(kind, entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const source = await readFile(entryPath, "utf8");
        for (const match of source.matchAll(
          /^\/\/ behavioral-composition-exception: ([A-Za-z][A-Za-z0-9]*)$/gmu,
        )) {
          markers.push({
            kind,
            path: path.relative(REPOSITORY_ROOT, entryPath),
            symbol: match[1]!,
          });
        }
      }
    }
  }

  for (const root of roots) {
    await visit(root.kind, path.join(REPOSITORY_ROOT, root.path));
  }

  return markers.sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Run one isolated reconcile lifecycle with a fresh production routing owner.
 *
 * Every case hands the pass a seed run. The reconcile-applied cascade renders
 * from the run's snapshot (D-05), and the nested orchestrated calls return
 * outcomes without emitting.
 */
function applyReconcile(
  opts: Omit<ApplyReconcileOptions, "completionCache" | "hooksRouting">,
): Promise<void> {
  return applyReconcileWithRouting({
    ...opts,
    completionCache: createCompletionCache(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
  });
}

/**
 * The single network edge. `allowedRemoteUrls` is empty, so the fake refuses
 * every remote: a cascade that reaches git at all fails the case (NFR-5).
 */
function createOfflineGitOps(): {
  readonly gitOps: GitOps;
  readonly clonedUrls: () => readonly string[];
} {
  const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [] });
  return { gitOps: git.gitOps, clonedUrls: () => git.state.calls.clone.map((call) => call.url) };
}

/**
 * A git edge that admits exactly the listed remotes and copies `fixtureSourceDir`
 * into the clone target. `cloneError` turns the admitted clone into a throw,
 * which is the provoker for the typed marketplace-add failure.
 */
function createRemoteGitOps(options: {
  readonly allowedRemoteUrls: readonly string[];
  readonly fixtureSourceDir?: string;
  readonly cloneError?: Error;
}): { readonly gitOps: GitOps; readonly clonedUrls: () => readonly string[] } {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: options.allowedRemoteUrls,
    ...(options.fixtureSourceDir !== undefined && {
      cloneFixture: { boundary: "local" as const, sourceDir: options.fixtureSourceDir },
    }),
    ...(options.cloneError !== undefined && { cloneError: options.cloneError }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(cloneOptions) {
      const { auth: _auth, ...withoutCallbacks } = cloneOptions;
      await git.gitOps.clone(withoutCallbacks);
    },
    async resolveRef(resolveOptions) {
      if (resolveOptions.ref === "refs/remotes/origin/HEAD") {
        const remoteMain = git.state.localRefs["refs/remotes/origin/main"];
        if (remoteMain !== undefined) {
          return remoteMain;
        }
      }

      return git.gitOps.resolveRef(resolveOptions);
    },
    async resolveRemoteRef(resolveOptions) {
      const { auth: _auth, ...withoutCallbacks } = resolveOptions;
      return git.gitOps.resolveRemoteRef(withoutCallbacks);
    },
  };
  return { gitOps, clonedUrls: () => git.state.calls.clone.map((call) => call.url) };
}

interface HermeticScopes {
  readonly cwd: string;
  readonly home: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
  /**
   * Make `directory` read-only for the rest of the case, which is how the
   * permission-refusal cells provoke a real EACCES without a seam. The mode is
   * restored inside the same teardown hook, ahead of the tree removal, because
   * a read-only directory cannot be removed.
   */
  readonly denyWrites: (directory: string) => Promise<void>;
  /**
   * Make `directory` writable again in the same teardown hook, ahead of the
   * tree removal, when it still exists then: a copy of a denied directory that
   * the case leaves behind, such as the one a failed skills undo keeps.
   */
  readonly restoreWrites: (directory: string) => void;
}

/**
 * One project root and one home root per case. Both roots are removed, both
 * environment variables restored, and every denied directory made writable
 * again in a single hook registered before the act phase, so a case that throws
 * mid-act still tears its tree down.
 */
async function createHermeticScopes(t: TestContext, label: string): Promise<HermeticScopes> {
  // Registered before the environment so the permissions come back before its
  // removal runs: after-hooks run in registration order.
  const denied: string[] = [];
  const copies: string[] = [];
  t.after(async () => {
    for (const directory of denied) {
      await chmod(directory, 0o755);
    }

    for (const directory of copies) {
      if (await pathExists(directory)) {
        await chmod(directory, 0o755);
      }
    }
  });
  const { cwd, home } = await createHermeticEnvironment(t, `apply-${label}-`);
  return {
    cwd,
    home,
    project: locationsFor("project", cwd),
    user: locationsFor("user", cwd),
    denyWrites: async (directory: string): Promise<void> => {
      // A 0o555 directory stays writable for uid 0, so under root the EACCES
      // this helper exists to provoke never happens and the case fails against
      // the reconcile logic instead of naming the environment. Refuse up front.
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        throw new Error("denyWrites cannot deny root; run this suite as a non-root user");
      }

      denied.push(directory);
      await chmod(directory, 0o555);
    },
    restoreWrites: (directory: string): void => {
      copies.push(directory);
    },
  };
}

/**
 * The message a read of `filePath` fails with, its path cut to the basename as
 * a redacted row shows it. Node 26 appends the path to an fs error message and
 * Node 24 does not, so a case reads the wording back from the runtime.
 */
async function redactedReadErrorMessage(filePath: string): Promise<string> {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    assert.ok(error instanceof Error);
    return error.message.replaceAll(filePath, path.basename(filePath));
  }

  assert.fail(`${filePath} was readable`);
}

/** Write `bytes` at `filePath`, creating the parent directory first. */
async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

interface PluginTree {
  /** `malformed` leaves the SKILL.md frontmatter unparseable, which degrades the staged skill. */
  readonly skill?: "clean" | "malformed";
  readonly command?: boolean;
  /**
   * One entry per agent file. `with-tools` declares a `tools:` list and
   * converts warning-free; `with-mcp-servers` declares an agent-level
   * `mcpServers:` field, which the bridge drops with exactly one guidance
   * warning per file (#179).
   */
  readonly agents?: readonly ("with-tools" | "with-mcp-servers")[];
  readonly mcpServer?: boolean;
  readonly hooks?: boolean;
  /** hooks.json whose kept handler carries a rewake field without `asyncRewake: true`. */
  readonly orphanRewakeHooks?: boolean;
  /** `.lsp.json` convention file -- a component kind the resolver cannot support. */
  readonly lsp?: boolean;
  /** A single well-formed `workflows/` script (ENBL-07's stagedWorkflows signal). */
  readonly workflow?: boolean;
  /** DFEN-04: stamp `defaultEnabled` on the plugin's MARKETPLACE ENTRY. */
  readonly entryDefaultEnabled?: boolean;
  /**
   * D-05-16: bare dependency tokens, written into BOTH the marketplace entry and
   * the plugin's own manifest so the dependents guard reads the same answer
   * whichever the offline read reaches first (D-05-06).
   */
  readonly dependencies?: readonly string[];
}

/**
 * The `hooks.json` arm, extracted so `writePluginTree` stays inside the
 * project's cognitive-complexity ceiling: both the orphan-rewake variant and
 * the workflow arm landed on that one function, and it is the arm that carries
 * a nested conditional of its own.
 */
async function writeHooksConfig(pluginRoot: string, tree: PluginTree): Promise<void> {
  if (tree.hooks !== true && tree.orphanRewakeHooks !== true) {
    return;
  }

  const hook =
    tree.orphanRewakeHooks === true
      ? { type: "command", command: "echo orphan", rewakeMessage: "wake me" }
      : { type: "command", command: "echo hi" };
  await writeUnder(
    path.join(pluginRoot, "hooks", "hooks.json"),
    JSON.stringify({ PreToolUse: [{ matcher: "", hooks: [hook] }] }),
  );
}

async function writePluginTree(
  marketplaceRoot: string,
  plugin: string,
  tree: PluginTree,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin,
      version: "1.0.0",
      ...(tree.dependencies !== undefined && { dependencies: tree.dependencies }),
    }),
  );
  if (tree.skill !== undefined) {
    await writeUnder(
      path.join(pluginRoot, "skills", "tool", "SKILL.md"),
      tree.skill === "malformed"
        ? "---\nname: [unterminated\n---\n\nbody\n"
        : "---\nname: tool\n---\n\nbody\n",
    );
  }

  if (tree.command === true) {
    await writeUnder(path.join(pluginRoot, "commands", "deploy.md"), "# deploy\n\nbody\n");
  }

  for (const [index, tools] of (tree.agents ?? []).entries()) {
    await writeUnder(
      path.join(pluginRoot, "agents", `bot${String(index)}.md`),
      `---\nname: bot${String(index)}\ndescription: helper\n` +
        (tools === "with-tools" ? "tools: Read, Bash, Edit\n" : "mcpServers: echo\n") +
        "---\n\nbody\n",
    );
  }

  if (tree.mcpServer === true) {
    await writeUnder(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { echo: { command: "echo", args: ["hi"] } } }),
    );
  }

  await writeHooksConfig(pluginRoot, tree);

  if (tree.lsp === true) {
    await writeUnder(
      path.join(pluginRoot, ".lsp.json"),
      JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
    );
  }

  if (tree.workflow === true) {
    await writeUnder(
      path.join(pluginRoot, "workflows", "greet.js"),
      'export const meta = { name: "greet", description: "greets" };\n',
    );
  }
}

/** Lay down the plugin trees and the marketplace manifest that declares them. */
async function writeMarketplaceSource(
  parentDir: string,
  directory: string,
  marketplace: string,
  trees: Readonly<Record<string, PluginTree>>,
  allowedDependencyMarketplaces?: readonly string[],
): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const marketplaceRoot = path.join(parentDir, directory);
  for (const [plugin, tree] of Object.entries(trees)) {
    await writePluginTree(marketplaceRoot, plugin, tree);
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      ...(allowedDependencyMarketplaces !== undefined && {
        allowCrossMarketplaceDependenciesOn: [...allowedDependencyMarketplaces],
      }),
      plugins: Object.entries(trees).map(([plugin, tree]) => ({
        name: plugin,
        version: "1.0.0",
        source: `./plugins/${plugin}`,
        ...(tree.entryDefaultEnabled !== undefined && {
          defaultEnabled: tree.entryDefaultEnabled,
        }),
        ...(tree.dependencies !== undefined && { dependencies: tree.dependencies }),
      })),
    }),
  );
  return { marketplaceRoot, manifestPath };
}

interface RecordSeed {
  readonly pluginRoot: string;
  readonly enabled?: boolean;
  /** LOAD-02: the load-time check's own marker on a record it disabled. */
  readonly dependencyDisabled?: boolean;
  readonly installable?: boolean;
  readonly supported?: readonly string[];
  readonly unsupported?: readonly string[];
  readonly skills?: readonly string[];
  readonly prompts?: readonly string[];
  readonly agents?: readonly string[];
  readonly mcpServers?: readonly string[];
  readonly hooks?: readonly string[];
}

/**
 * D-10: the supported kinds a record's resources imply, so a seeded record
 * whose plugin tree has not grown is not a growth move `apply` re-materializes.
 */
function impliedSupported(seed: RecordSeed): string[] {
  return [
    ...((seed.skills ?? []).length > 0 ? ["skills"] : []),
    ...((seed.prompts ?? []).length > 0 ? ["commands"] : []),
    ...((seed.agents ?? []).length > 0 ? ["agents"] : []),
    ...((seed.hooks ?? []).length > 0 ? ["hooks"] : []),
  ];
}

function pluginRecord(seed: RecordSeed): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: seed.pluginRoot,
    compatibility: {
      installable: seed.installable ?? true,
      notes: [],
      supported: [...(seed.supported ?? impliedSupported(seed))],
      unsupported: [...(seed.unsupported ?? [])],
    },
    resources: {
      skills: [...(seed.skills ?? [])],
      prompts: [...(seed.prompts ?? [])],
      agents: [...(seed.agents ?? [])],
      mcpServers: [...(seed.mcpServers ?? [])],
      hooks: [...(seed.hooks ?? [])],
      workflows: [],
    },
    enabled: seed.enabled ?? true,
    ...(seed.dependencyDisabled !== undefined && {
      dependencyDisabled: seed.dependencyDisabled,
    }),
    provenance: "explicit",
    installedAt: RECORDED_AT,
    updatedAt: RECORDED_AT,
  };
}

/** Populate one lifecycle owner with an observable project-scope route. */
async function populateRuntimeRoute(
  cwd: string,
  runtime: HooksRuntime,
  opts: { readonly command: string; readonly marketplace: string; readonly plugin: string },
): Promise<HooksRouting> {
  const pluginRoot = path.join(cwd, "runtime-routes", `${opts.marketplace}-${opts.plugin}`);
  const hooksJsonPath = path.join(pluginRoot, "hooks.json");
  await writeUnder(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ command: opts.command, type: "command" }], matcher: "" }],
    }),
  );
  const hooksRouting = createHooksRouting(runtime, { readHooksJson });
  await hooksRouting.readAndCachePluginHooks({
    cwd,
    hooksJsonPath,
    logPrefix: "reconcile-uninstall-owner-test",
    marketplace: opts.marketplace,
    plugin: opts.plugin,
    resolvedSource: asAbsolutePluginRoot(pluginRoot),
    scope: "project",
  });
  hooksRouting.rebuildRoutingTables();
  return hooksRouting;
}

function marketplaceRecord(options: {
  readonly cwd: string;
  readonly scope: "project" | "user";
  readonly marketplace: string;
  readonly rawSource: string;
  readonly manifestPath: string;
  readonly marketplaceRoot: string;
  readonly plugins?: Readonly<Record<string, PluginRecord>>;
  /** The stored source; defaults to the path source `rawSource`. */
  readonly source?: ParsedSource;
}): MarketplaceRecord {
  return {
    name: options.marketplace,
    scope: options.scope,
    source: options.source ?? pathSource(options.rawSource),
    addedFromCwd: options.cwd,
    manifestPath: options.manifestPath,
    marketplaceRoot: options.marketplaceRoot,
    plugins: { ...(options.plugins ?? {}) },
  };
}

/** Write state.json under the scope's extension root, creating the root first. */
async function seedState(locations: ScopedLocations, state: ExtensionState): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, state);
}

/**
 * A project scope that records the path marketplace `mp` offering `hello`,
 * with the two layer configs written as given.
 */
async function seedLayerScope(
  t: TestContext,
  label: string,
  layers: {
    readonly base: (marketplaceRoot: string) => string;
    readonly local: (marketplaceRoot: string) => string;
  },
): Promise<{ readonly cwd: string; readonly project: ScopedLocations }> {
  const { cwd, project } = await createHermeticScopes(t, label);
  const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
    hello: { skill: "clean" },
  });
  await writeUnder(project.baseConfigJsonPath, layers.base(marketplaceRoot));
  await writeUnder(project.localConfigJsonPath, layers.local(marketplaceRoot));
  await seedState(project, {
    schemaVersion: 3,
    marketplaces: {
      mp: marketplaceRecord({
        cwd,
        scope: "project",
        marketplace: "mp",
        rawSource: marketplaceRoot,
        manifestPath,
        marketplaceRoot,
      }),
    },
  });
  return { cwd, project };
}

/** The bytes of one `claude-plugins.json` / `claude-plugins.local.json` file. */
function configBytes(declaration: {
  readonly marketplaces?: Readonly<Record<string, { readonly source: string }>>;
  readonly plugins?: Readonly<Record<string, { readonly enabled?: boolean }>>;
}): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      ...(declaration.marketplaces !== undefined && { marketplaces: declaration.marketplaces }),
      ...(declaration.plugins !== undefined && { plugins: declaration.plugins }),
    },
    null,
    2,
  );
}

/**
 * LOAD-02: re-plan one scope from what is on disk, the way the read pass does.
 *
 * The convergence question is about the SECOND pass, so the plan has to be
 * built from the state and config the first pass left behind rather than from
 * the literals the case seeded. There is no `.local.json` in these fixtures, so
 * the merge takes an empty local half.
 */
async function replanFromDisk(locations: ScopedLocations): Promise<ReconcilePlan> {
  const state = await loadState(locations.extensionRoot);
  const loaded = await loadConfig(locations.baseConfigJsonPath);
  assert.equal(loaded.status, "valid");
  const merged = mergeScopeConfigs(loaded.status === "valid" ? loaded.config : {}, {});
  const verdict = await buildScopeSatisfactionVerdict({ state, locations });
  return planReconcile(merged, state, locations.scope, verdict);
}

/** Read one plugin record back through the persistence loader. */
async function recordFor(
  locations: ScopedLocations,
  marketplace: string,
  plugin: string,
): Promise<PluginRecord | undefined> {
  return (await loadState(locations.extensionRoot)).marketplaces[marketplace]?.plugins[plugin];
}

/**
 * Create an apply operation whose required selected-state reader leaves a
 * competing state on disk after returning the planner's snapshot. The real
 * child orchestrators then observe that competing state through their normal
 * locked re-reads, so the behavioral-composition proof remains intact while
 * the race is owned by the production reader boundary.
 */
function applyAfterSelectedStateRace(
  locations: ScopedLocations,
  competing: ExtensionState | string,
): (
  opts: Omit<ApplyReconcileOptions, "completionCache" | "hooksRouting"> &
    Partial<Pick<ApplyReconcileOptions, "completionCache" | "hooksRouting">>,
) => Promise<void> {
  let raced = false;
  const applySelectedReconcile = createApplyReconcile({
    async loadState(extensionRoot: string): Promise<ExtensionState> {
      const selected = await loadState(extensionRoot);
      if (!raced && extensionRoot === locations.extensionRoot) {
        raced = true;
        if (typeof competing === "string") {
          await writeFile(locations.stateJsonPath, competing, "utf8");
        } else {
          await saveState(extensionRoot, competing);
        }
      }

      return selected;
    },
  });
  return (opts) =>
    applySelectedReconcile({
      ...opts,
      completionCache: opts.completionCache ?? createCompletionCache(),
      hooksRouting:
        opts.hooksRouting ?? createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });
}

/** APL-01 / D-08: the advisory an apply pass that accumulates no outcome sends. */
const APPLY_EMPTY_NOTICE = { message: "Apply: nothing to change." } satisfies Notification;

/**
 * MISS-02 / D-09-14: the row an apply reports for the missing dependency
 * `secrets-vault@mp` that its marketplace does not list, once the dependent is
 * already down.
 */
const SECRETS_VAULT_NOT_IN_MANIFEST = {
  message:
    "A plugin operation has failed.\n" +
    "\n" +
    "● mp [project]\n" +
    "  ⊘ secrets-vault (failed) {not in manifest}\n" +
    "\n" +
    "Reconcile: 1 failure",
  severity: "error",
} satisfies Notification;

/**
 * AFILE-04: the warning `notifyMcpConfigNotices` sends after a rewrite drops the
 * comments of the project-scope `mcp-adapter.json`.
 */
const COMMENTS_REMOVED_NOTICE = {
  message:
    "MCP config comments removed.\n" +
    "\n" +
    "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
  severity: "warning",
} satisfies Notification;

interface CommentedAdapterSeed {
  readonly trees: Readonly<Record<string, PluginTree>>;
  /** The config's plugin declarations; `undefined` drops `mp` from the config. */
  readonly declared: Readonly<Record<string, { readonly enabled?: boolean }>> | undefined;
  readonly recorded: Readonly<Record<string, Omit<RecordSeed, "pluginRoot">>>;
  /** Recorded plugins that own one server entry in the adapter file. */
  readonly owners: readonly string[];
}

/**
 * AFILE-04: one project scope over the path marketplace `mp`, whose
 * `mcp-adapter.json` opens with a comment and holds one owned server per
 * `owners` entry. Returns the adapter bytes as written.
 */
async function seedCommentedAdapterScope(
  t: TestContext,
  label: string,
  seed: CommentedAdapterSeed,
): Promise<Pick<HermeticScopes, "cwd" | "project" | "denyWrites"> & { readonly adapter: string }> {
  const { cwd, project, denyWrites } = await createHermeticScopes(t, label);
  const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
    cwd,
    "mp-src",
    "mp",
    seed.trees,
  );
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes(
      seed.declared === undefined
        ? { marketplaces: {} }
        : { marketplaces: { mp: { source: marketplaceRoot } }, plugins: seed.declared },
    ),
  );
  const plugins = Object.fromEntries(
    Object.entries(seed.recorded).map(([plugin, record]) => [
      plugin,
      pluginRecord({ ...record, pluginRoot: path.join(marketplaceRoot, "plugins", plugin) }),
    ]),
  );
  await seedState(project, {
    schemaVersion: 3,
    marketplaces: {
      mp: marketplaceRecord({
        cwd,
        scope: "project",
        marketplace: "mp",
        rawSource: marketplaceRoot,
        manifestPath,
        marketplaceRoot,
        plugins,
      }),
    },
  });
  const servers = Object.fromEntries(
    seed.owners.map((plugin) => [
      `${plugin}-echo`,
      { command: "echo", _piClaudeMarketplace: { plugin, marketplace: "mp" } },
    ]),
  );
  const adapter = `// user note\n${JSON.stringify({ mcpServers: servers })}\n`;
  await writeUnder(project.mcpAdapterJsonPath, adapter);
  return { cwd, project, adapter, denyWrites };
}

test("D-05-02: the source and owner-test census contains exactly the two approved behavioral-composition exceptions", async () => {
  // act & assert
  assert.deepStrictEqual(await compositionExceptionCensus(), [
    {
      kind: "production",
      path: "extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts",
      symbol: "bootstrapClaudePlugin",
    },
    {
      kind: "production",
      path: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts",
      symbol: "applyReconcile",
    },
    {
      kind: "test",
      path: "test/orchestrators/plugin/bootstrap.test.ts",
      symbol: "bootstrapClaudePlugin",
    },
    {
      kind: "test",
      path: "test/orchestrators/reconcile/apply.test.ts",
      symbol: "applyReconcile",
    },
  ]);
});

test("apply.ts exposes the reconcile factories and no composed value", async () => {
  // arrange
  const applyModule =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts");

  // act
  const exportNames = Object.keys(applyModule);

  // assert
  assert.deepStrictEqual(exportNames, ["createApplyReconcile", "createScopeDependencyInstall"]);
});

describe("applyReconcile", () => {
  test("WR-05 / D-08: leaves a scope with neither a state file nor a config untouched and reports nothing to change", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "pristine");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("AAP-02 / D-07: an autoapply load with nothing to change prints nothing", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "pristine-load");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    // A load run carries no command state, as `index.ts` opens it.
    const { commandState: _commandState, ...snapshot } = runWithNothingLoaded();
    const run: NotificationRun = { ...snapshot, origin: { kind: "load" } };

    // act
    await applyReconcile({ ctx, run, cwd, gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("CFG-03: reports an unparseable base config by basename, skips that scope's apply pass, and removes nothing", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "invalid-base");
    const seeded: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        "should-stay": marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "should-stay",
          rawSource: path.join(cwd, "nowhere"),
          manifestPath: path.join(cwd, "nowhere", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(cwd, "nowhere"),
        }),
      },
    };
    await seedState(project, seeded);
    await writeUnder(project.baseConfigJsonPath, "{");
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
          "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
          "    cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), seeded);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), "{");
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LAYER-06: a plugin whose marketplace no layer declares keeps its dangling reference row while the scope still installs", async (t) => {
    // arrange
    const { cwd, project } = await seedLayerScope(t, "layer-gap-dangling", {
      base: (root) =>
        configBytes({ marketplaces: { mp: { source: root } }, plugins: { "hello@mp": {} } }),
      local: () => configBytes({ plugins: { "ghost@nowhere": {} } }),
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● hello v1.0.0 (installed)\n" +
          "\n" +
          "⊘ nowhere [project] (failed) {dangling reference}\n" +
          "  ⊘ ghost (failed) {dangling reference}\n" +
          "\n" +
          "Reconcile: 2 failures, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "hello"))?.enabled, true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-01: an unparseable state file in one scope reports unparseable and never stops the sibling scope reconciling", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "corrupt-state");
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(project.stateJsonPath, "{ not json");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
      cwd,
      "user-src",
      "user-mp",
      {},
    );
    await writeUnder(user.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await seedState(user, {
      schemaVersion: 3,
      marketplaces: {
        "user-mp": marketplaceRecord({
          cwd,
          scope: "user",
          marketplace: "user-mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ state.json [project] (failed) {unparseable}\n" +
          "  ⊘ state.json (failed) {unparseable}\n" +
          "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
          "\n" +
          "● user-mp [user] (removed)\n" +
          "\n" +
          "Reconcile: 2 failures, 1 success",
        severity: "error",
      },
    ]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), "{ not json");
    assert.deepStrictEqual((await loadState(user.extensionRoot)).marketplaces, {});
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  const addBatchOrders = [
    { name: "first", keys: ["mike-mp", "zulu-mp", "alfa-mp"] },
    { name: "middle", keys: ["zulu-mp", "mike-mp", "alfa-mp"] },
    { name: "last", keys: ["zulu-mp", "alfa-mp", "mike-mp"] },
  ] as const satisfies readonly { readonly name: string; readonly keys: readonly string[] }[];

  for (const { name, keys } of addBatchOrders) {
    test(`RECON-01: adds every declared marketplace and reports the same aggregate when the unreachable source is declared ${name}`, async (t) => {
      // arrange
      const { cwd, project } = await createHermeticScopes(t, `add-${name}`);
      const zulu = await writeMarketplaceSource(cwd, "zulu-src", "zulu-mp", {});
      const alfa = await writeMarketplaceSource(cwd, "alfa-src", "alfa-mp", {});
      const sources: Readonly<Record<string, string>> = {
        "zulu-mp": zulu.marketplaceRoot,
        "alfa-mp": alfa.marketplaceRoot,
        "mike-mp": path.join(cwd, "absent-src"),
      };
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({
          marketplaces: Object.fromEntries(keys.map((key) => [key, { source: sources[key]! }])),
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {},
      });
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n" +
            "\n" +
            "● alfa-mp [project] (added)\n" +
            "\n" +
            "⊘ mike-mp [project] (failed) {source missing}\n" +
            "\n" +
            "● zulu-mp [project] (added)\n" +
            "\n" +
            "Reconcile: 1 failure, 2 successes",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(
        Object.keys((await loadState(project.extensionRoot)).marketplaces).sort(),
        ["alfa-mp", "zulu-mp"],
      );
      assert.deepStrictEqual(await retryTree(project.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("RECON-03: a marketplace whose clone cannot reach the remote reports network unreachable while its sibling is still added", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "add-remote");
    const local = await writeMarketplaceSource(cwd, "local-src", "local-mp", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: {
          "local-mp": { source: local.marketplaceRoot },
          "remote-mp": { source: "acme/remote" },
        },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    const unreachable = new Error("connect ENETUNREACH");
    (unreachable as { code?: string }).code = "ENETUNREACH";
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/remote.git"],
      cloneError: unreachable,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n" +
          "\n" +
          "● local-mp [project] (added)\n" +
          "\n" +
          "⊘ remote-mp [project] (failed) {network unreachable}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 success",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(project.extensionRoot)).marketplaces), [
      "local-mp",
    ]);
    assert.deepStrictEqual(clonedUrls(), ["https://github.com/acme/remote.git"]);
    verifyBoundary();
  });

  test("RECON-02 / WR-02: removing an undeclared marketplace renders one uninstalled child row per plugin the cascade unstaged", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "remove-clean");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
              skills: ["hello-tool"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "hello-tool", "SKILL.md"),
      "---\nname: hello-tool\n---\n\nbody\n",
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] (removed)\n" +
          "  ○ hello (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await loadState(project.extensionRoot)).marketplaces, {});
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("APPLYTHROW-01: an invalid GitHub base address stops the pass after a removal and an MCP move, and both are reported before the throw", async (t) => {
    // arrange: the removal of `mp` runs before the add of `remote-mp`, whose
    // clone fails on the variable, so the pass throws after the removal and
    // the MCP move have committed.
    const { cwd, project } = await createHermeticScopes(t, "apply-throw");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/remote" } } }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "hello") }),
          },
        }),
      },
    });
    const migrateMcpEntries: McpMigrationStep = async (input) => {
      input.rows.push({
        kind: "moved",
        scope: input.scope,
        plugin: "hello",
        marketplace: "mp",
        from: "srv",
        to: "plugin_hello_srv_",
      });
      await Promise.resolve();
    };

    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const { gitOps } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/remote.git"],
      cloneError: invalid,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

    // act
    const pass = applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      migrateMcpEntries,
    });

    // assert
    await assert.rejects(pass, (err: unknown) => err === invalid);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.\n" +
          "\n" +
          "Moved to mcp-adapter.json:\n" +
          "  srv -> plugin_hello_srv_ (hello) [project]\n" +
          "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.\n" +
          "/reload to pick up changes",
        severity: "info",
      },
      {
        message:
          "● mp [project] (removed)\n" +
          "  ○ hello (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await loadState(project.extensionRoot)).marketplaces, {});
    verifyBoundary();
  });

  test("APPLYTHROW-01: a pass that throws before any step commits reports nothing and sends no apply-empty advisory", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "apply-throw-empty");
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/remote" } } }),
    );
    await seedState(project, { schemaVersion: 3, marketplaces: {} });
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const { gitOps } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/remote.git"],
      cloneError: invalid,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const pass = applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    await assert.rejects(pass, (err: unknown) => err === invalid);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("D-22-02: a removal that unstages one plugin and is refused on another renders both children under a bare failed header", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "remove-partial");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      good: { skill: "clean" },
      stuck: { hooks: true },
    });
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            good: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "good"),
              skills: ["good-tool"],
            }),
            stuck: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "stuck"),
              hooks: ["stuck"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "good-tool", "SKILL.md"),
      "---\nname: good-tool\n---\n\nbody\n",
    );
    await writeUnder(
      path.join(project.extensionRoot, "hooks", "stuck", "hooks.json"),
      JSON.stringify({ PreToolUse: [] }),
    );
    await denyWrites(path.join(project.extensionRoot, "hooks", "stuck"));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ mp [project] (failed)\n" +
          "  ○ good (uninstalled)\n" +
          "  ⊘ stuck (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 2 failures, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      ["stuck"],
    );
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/hooks/",
      "pi-claude-marketplace/hooks/stuck/",
      "pi-claude-marketplace/hooks/stuck/hooks.json",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-22-02: a removal refused on its only plugin still renders that plugin's row under a bare failed header", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "remove-all-refused");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      stuck: { hooks: true },
    });
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            stuck: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "stuck"),
              hooks: ["stuck"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.extensionRoot, "hooks", "stuck", "hooks.json"),
      JSON.stringify({ PreToolUse: [] }),
    );
    await denyWrites(path.join(project.extensionRoot, "hooks", "stuck"));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ mp [project] (failed)\n" +
          "  ⊘ stuck (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(project.extensionRoot)).marketplaces), [
      "mp",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-03 / MISS-01: a config-driven uninstall of a still-declared plugin proceeds and the next pass installs it back as a missing dependency", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-still-declared");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      keeper: { skill: "clean", dependencies: ["orphan"] },
      orphan: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "keeper@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            keeper: pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "keeper"),
            }),
            orphan: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    const afterSecond = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled)\n" +
          "  ◍ keeper v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "orphan@mp" or uninstall "keeper@mp"\n' +
          "\n" +
          "Reconcile: 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
      {
        message:
          "● mp [project]\n" +
          "  ● orphan v1.0.0 (installed) {dependency installed}\n" +
          "  ● keeper v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    // LOAD-03: the removal happened on the FIRST pass -- the reconcile-driven
    // uninstall does not refuse. APPLY1-01: no apply leaves `keeper` enabled on
    // its missing dependency, so the same pass disables it. MISS-01 / D-02: the
    // next pass installs the dependency and enables `keeper` again.
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), ["keeper"]);
    assert.equal(afterFirst.marketplaces["mp"]?.plugins["keeper"]?.enabled, false);
    assert.deepStrictEqual(Object.keys(afterSecond.marketplaces["mp"]?.plugins ?? {}), [
      "keeper",
      "orphan",
    ]);
    assert.equal(afterSecond.marketplaces["mp"]?.plugins["keeper"]?.enabled, true);
    assert.equal(afterSecond.marketplaces["mp"]?.plugins["keeper"]?.dependencyDisabled, undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-03: dropping a plugin and its dependent together converges in ONE pass in plain record order", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-refused-order");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      keeper: { skill: "clean", dependencies: ["orphan"] },
      orphan: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          // D-03-07 post-order: the dependency's record precedes its declarer's,
          // removing `orphan` first meets a still-recorded `keeper` that declared
          // it. LOAD-03 does not refuse that removal, so the bucket settles in
          // plain record order and the retry loop has nothing to retry.
          plugins: {
            orphan: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") }),
            keeper: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "keeper") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled)\n" +
          "  ○ keeper v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-05-16 / PU-5: a converged entry beside a still-declared removal is settled in one pass", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-converged-beside-declared");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      gone: { skill: "clean" },
      keeper: { skill: "clean", dependencies: ["orphan"] },
      orphan: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "keeper@mp": {} },
      }),
    );
    const orphan = pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") });
    const keeper = pluginRecord({
      supported: ["skills"],
      pluginRoot: path.join(marketplaceRoot, "plugins", "keeper"),
    });
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            gone: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "gone") }),
            orphan,
            keeper,
          },
        }),
      },
    });
    const competingState: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: { orphan, keeper },
        }),
      },
    };
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const uninstallPlugin = t.mock.fn(createUninstallOperation(hooksRouting, completionCache));
    const applyWithRace = applyAfterSelectedStateRace(project, competingState);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      hooksRouting,
      completionCache,
      uninstallPlugin,
    });

    // assert
    // APPLY1-01: `keeper` declares the removed `orphan`, so the same pass
    // disables it; the next pass installs `orphan` back (MISS-01).
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled)\n" +
          "  ◍ keeper v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "orphan@mp" or uninstall "keeper@mp"\n' +
          "\n" +
          "Reconcile: 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      ["keeper"],
    );
    assert.deepStrictEqual(
      uninstallPlugin.mock.calls.map(
        (call) => `${call.arguments[0].plugin}@${call.arguments[0].marketplace}`,
      ),
      ["gone@mp", "orphan@mp"],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-05-16 / D-05-07: a removal refused by an unreadable declarer is retried after the rest of the pass and then settles", async (t) => {
    // arrange: `stray` is recorded but its marketplace does not declare it, so
    // its declarations cannot be established. Uninstalling `victim` therefore
    // refuses (the walk excludes only the target), while uninstalling `stray`
    // itself succeeds -- which is exactly the ordering the retry loop exists
    // for. It is the D-05-07 refusal that keeps the loop earning its keep now
    // that LOAD-03 retired the dependents refusal.
    const { cwd, project } = await createHermeticScopes(t, "uninstall-refused-unreadable");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      victim: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            victim: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "victim") }),
            stray: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "stray") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ stray v1.0.0 (uninstalled)\n" +
          "  ○ victim v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      [],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-05-16 / D-05-07: a refusal that no retry can settle reports its own row and removes nothing", async (t) => {
    // arrange: `stray` is recorded, unreadable AND still declared in the
    // config, so it is never uninstalled and never becomes readable. The
    // refusal it causes therefore survives every retry, which is the arm that
    // reports the refused outcomes instead of retrying them again.
    const { cwd, project } = await createHermeticScopes(t, "uninstall-refused-terminal");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      victim: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "stray@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            victim: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "victim") }),
            stray: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "stray") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ victim (failed) {unreadable}\n" +
          "    cause: cannot read the dependencies of stray@mp: not declared by its marketplace, and its installed copy cannot be read\n" +
          // REC-05: `stray` itself is declared but its marketplace does not
          // list it, so its own row is the stale-declarer warning.
          "  ⊘ stray (failed) {not in manifest}\n" +
          "    cause: cannot read the dependencies of stray@mp: not declared by its marketplace, and its installed copy cannot be read\n" +
          "\n" +
          "Reconcile: 1 failure, 1 warning",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      ["victim", "stray"],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-06: a plugin whose declaration is deleted is uninstalled while its marketplace stays recorded, and the next pass has nothing to change", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-direct");
    const pluginDataDir = await project.pluginDataDir("mp", "hello");
    await writeUnder(path.join(pluginDataDir, "nested", "history"), "reconcile history\n");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: {},
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
              skills: ["hello-tool"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "hello-tool", "SKILL.md"),
      "---\nname: hello-tool\n---\n\nbody\n",
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const ownerRuntime = createHooksRuntime();
    const peerRuntime = createHooksRuntime();
    const hooksRouting = await populateRuntimeRoute(cwd, ownerRuntime, {
      command: "echo reconcile-target",
      marketplace: "mp",
      plugin: "hello",
    });
    await populateRuntimeRoute(cwd, ownerRuntime, {
      command: "echo reconcile-unrelated",
      marketplace: "mp",
      plugin: "other",
    });
    await populateRuntimeRoute(cwd, peerRuntime, {
      command: "echo reconcile-peer",
      marketplace: "mp",
      plugin: "hello",
    });
    const completionCache = createCompletionCache();
    const peerCompletionCache = createCompletionCache();
    const pluginCachePath = await project.pluginCacheFile("mp");
    const unrelatedCachePath = await project.pluginCacheFile("unrelated");
    await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () =>
      Promise.resolve([{ name: "hello", status: "installed" }]),
    );
    await rm(pluginCachePath, { force: true });
    await peerCompletionCache.getPluginIndex(pluginCachePath, "project", "mp", () =>
      Promise.resolve([{ name: "peer-hello", status: "installed" }]),
    );
    await rm(pluginCachePath, { force: true });
    await completionCache.getPluginIndex(unrelatedCachePath, "project", "unrelated", () =>
      Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
    );
    await rm(unrelatedCachePath, { force: true });
    await peerCompletionCache.getPluginIndex(unrelatedCachePath, "project", "unrelated", () =>
      Promise.resolve([{ name: "peer-unrelated", status: "available" }]),
    );
    await rm(path.dirname(path.dirname(unrelatedCachePath)), { force: true, recursive: true });

    // act
    await applyReconcileWithRouting({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache,
      gitOps,
      hooksRouting,
    });
    const afterFirst = await loadState(project.extensionRoot);
    const dataExistsAfterFirst = await pathExists(pluginDataDir);
    await applyReconcileWithRouting({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache,
      gitOps,
      hooksRouting,
    });
    const afterSecondTree = await retryTree(project.scopeRoot);
    let ownerRebuilds = 0;
    const ownerRows = await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () => {
      ownerRebuilds += 1;
      return Promise.resolve([{ name: "hello", status: "available" }]);
    });
    const peerRows = await peerCompletionCache.getPluginIndex(
      pluginCachePath,
      "project",
      "mp",
      () => Promise.reject(new Error("peer cache must stay warm")),
    );
    const ownerUnrelatedRows = await completionCache.getPluginIndex(
      unrelatedCachePath,
      "project",
      "unrelated",
      () => Promise.reject(new Error("owner unrelated cache must stay warm")),
    );
    const peerUnrelatedRows = await peerCompletionCache.getPluginIndex(
      unrelatedCachePath,
      "project",
      "unrelated",
      () => Promise.reject(new Error("peer unrelated cache must stay warm")),
    );

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), []);
    assert.strictEqual(dataExistsAfterFirst, false);
    assert.deepStrictEqual(await loadState(project.extensionRoot), afterFirst);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(afterSecondTree, [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/data/",
      "pi-claude-marketplace/data/mp/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    assert.deepStrictEqual(
      ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
      ["other"],
    );
    assert.deepStrictEqual(
      peerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
      ["hello"],
    );
    assert.equal(ownerRebuilds, 1);
    assert.deepStrictEqual(ownerRows, [{ name: "hello", status: "available" }]);
    assert.deepStrictEqual(peerRows, [{ name: "peer-hello", status: "installed" }]);
    assert.deepStrictEqual(ownerUnrelatedRows, [{ name: "owner-unrelated", status: "available" }]);
    assert.deepStrictEqual(peerUnrelatedRows, [{ name: "peer-unrelated", status: "available" }]);
    verifyBoundary();
  });

  test("WR-06: a cache-file cleanup failure stays silent while apply removes the target and preserves its sibling", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-cache-failure");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
      kept: { skill: "clean" },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "kept@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    const kept = pluginRecord({
      pluginRoot: path.join(marketplaceRoot, "plugins", "kept"),
      skills: ["kept-tool"],
    });
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
              skills: ["hello-tool"],
            }),
            kept,
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "hello-tool", "SKILL.md"),
      "---\nname: hello-tool\n---\n\nbody\n",
    );
    await writeUnder(
      path.join(project.skillsTargetDir, "kept-tool", "SKILL.md"),
      "---\nname: kept-tool\n---\n\nbody\n",
    );
    const ownerRuntime = createHooksRuntime();
    await populateRuntimeRoute(cwd, ownerRuntime, {
      command: "echo removed",
      marketplace: "mp",
      plugin: "hello",
    });
    const hooksRouting = await populateRuntimeRoute(cwd, ownerRuntime, {
      command: "echo kept",
      marketplace: "mp",
      plugin: "kept",
    });
    const completionCache = createCompletionCache();
    const pluginCachePath = await project.pluginCacheFile("mp");
    await mkdir(pluginCachePath, { recursive: true });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcileWithRouting({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache,
      gitOps,
      hooksRouting,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      ["kept"],
    );
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/cache/",
      "pi-claude-marketplace/cache/plugins/",
      "pi-claude-marketplace/cache/plugins/mp.json/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/kept-tool/",
      "pi-claude-marketplace/resources/skills/kept-tool/SKILL.md",
      "pi-claude-marketplace/state.json",
    ]);
    assert.equal((await stat(pluginCachePath)).isDirectory(), true);
    assert.deepStrictEqual(
      ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
      ["kept"],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  const uninstallFaultPositions = [
    {
      name: "first",
      keys: ["zulu", "mike", "alfa"],
      rows: "  ⊘ zulu (failed) {permission denied}\n  ○ mike v1.0.0 (uninstalled)\n  ○ alfa v1.0.0 (uninstalled)",
    },
    {
      name: "middle",
      keys: ["mike", "zulu", "alfa"],
      rows: "  ○ mike v1.0.0 (uninstalled)\n  ⊘ zulu (failed) {permission denied}\n  ○ alfa v1.0.0 (uninstalled)",
    },
  ] as const satisfies readonly {
    readonly name: string;
    readonly keys: readonly string[];
    readonly rows: string;
  }[];

  for (const { name, keys, rows } of uninstallFaultPositions) {
    test(`RECON-03: a refused uninstall in ${name} position reports its own row and leaves the rest of the batch uninstalled`, async (t) => {
      // arrange
      const { cwd, denyWrites, project } = await createHermeticScopes(t, `uninstall-${name}`);
      const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
        alfa: { skill: "clean" },
        mike: { skill: "clean" },
        zulu: { hooks: true },
      });
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {
          mp: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "mp",
            rawSource: marketplaceRoot,
            manifestPath,
            marketplaceRoot,
            plugins: Object.fromEntries(
              keys.map((key) => [
                key,
                pluginRecord({
                  pluginRoot: path.join(marketplaceRoot, "plugins", key),
                  ...(key === "zulu" ? { hooks: ["zulu"] } : { skills: [`${key}-tool`] }),
                }),
              ]),
            ),
          }),
        },
      });
      for (const key of keys.filter((candidate) => candidate !== "zulu")) {
        await writeUnder(
          path.join(project.skillsTargetDir, `${key}-tool`, "SKILL.md"),
          `---\nname: ${key}-tool\n---\n\nbody\n`,
        );
      }

      await writeUnder(
        path.join(project.extensionRoot, "hooks", "zulu", "hooks.json"),
        JSON.stringify({ PreToolUse: [] }),
      );
      await denyWrites(path.join(project.extensionRoot, "hooks", "zulu"));
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n" +
            "\n" +
            "● mp [project]\n" +
            `${rows}\n` +
            "\n" +
            "Reconcile: 1 failure, 2 successes\n" +
            "\n" +
            "/reload to pick up changes",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(
        Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        ["zulu"],
      );
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("RECON-01: installs a newly declared plugin, records it, and leaves the declaration byte-identical", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-clean");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ● hello v1.0.0 (installed)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
    ]);
    const record = await recordFor(project, "mp", "hello");
    assert.deepStrictEqual(record?.resources, {
      agents: [],
      hooks: [],
      mcpServers: [],
      prompts: [],
      skills: ["hello-tool"],
      workflows: [],
    });
    assert.equal(record?.enabled, true);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/data/",
      "pi-claude-marketplace/data/mp/",
      "pi-claude-marketplace/data/mp/hello/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/hello-tool/",
      "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RESV-06: an install whose dependency the marketplace does not declare reports dependency failed and the dependency's own cause", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-dependency-failed");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", dependencies: ["missing"] },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert: the requesting plugin's row -- the only outcome reconcile drives
    // for `hello@mp` -- carries {dependency failed} and the dependency's own
    // cause line, not the {unreadable} probe fallback.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {dependency failed}\n" +
          '    cause: Dependency "missing@mp" is not declared by its marketplace.\n' +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RESV-06: an install whose OWN manifest entry is missing classifies as before, not as a dependency failure", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-own-failure");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "ghost@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert: no dependency is involved, so the plugin's own PluginShapeError
    // classification is unaffected by RESV-06.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ ghost (failed) {not in manifest}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "ghost"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RESV-06 / T-55-02-02 / T-53-02-02: a dependency's own ledger failure keeps its nested cause, redacted", async (t) => {
    // arrange: `bar` resolves and reaches its own ledger, where its one
    // command source file is unreadable -- a genuine nested cause (the raw
    // EACCES error) under the bridge's own descriptive wrapper, with an
    // absolute path only the inner link carries.
    const { cwd, project } = await createHermeticScopes(t, "install-dependency-nested-cause");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", dependencies: ["bar"] },
      bar: { command: true },
    });
    const commandFile = path.join(marketplaceRoot, "plugins", "bar", "commands", "deploy.md");
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      t.skip("cannot deny reads as root; run this suite as a non-root user");
      return;
    }

    // Save the mode and register its restoration before mutating, so the
    // permission bits come back even when an assertion below throws. The
    // restore itself tolerates ENOENT: `createHermeticScopes`'s tree-removal
    // hook, registered ahead of this one, may already have deleted the file.
    const { mode: originalMode } = await stat(commandFile);
    t.after(async () => {
      try {
        await chmod(commandFile, originalMode & 0o777);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    });
    await chmod(commandFile, 0o000);
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert: the dependency's own ledger error rides the row intact -- its
    // message AND its nested cause, both redacted -- instead of the single
    // truncated line RESV-06 forbids.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {dependency failed}\n" +
          '    cause: command "bar:deploy" of plugin "bar" could not be staged -> ' +
          "EACCES: permission denied, open 'deploy.md'\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    const [notification] = notifications;
    const wholeMessage = notification?.message ?? "";
    assert.doesNotMatch(wholeMessage, /\/[\w.-]+\/[\w.-]+/);
    assert.ok(!wholeMessage.includes(marketplaceRoot));
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.equal(await recordFor(project, "mp", "bar"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIM-03 / D-PL6-12: an install whose skills undo cannot finish reports the rollback phase, redacted", async (t) => {
    // arrange
    const { cwd, denyWrites, project, restoreWrites } = await createHermeticScopes(
      t,
      "install-rollback-partial",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const readOnly = path.join(marketplaceRoot, "plugins", "hello", "skills", "tool", "read-only");
    await writeUnder(path.join(readOnly, "data.txt"), "data\n");
    await denyWrites(readOnly);
    restoreWrites(
      path.join(project.extensionRoot, "resources", "skills", "hello-tool", "read-only"),
    );
    await mkdir(project.mcpAdapterJsonPath, { recursive: true });
    const adapterReadError = await redactedReadErrorMessage(project.mcpAdapterJsonPath);
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {rollback partial}\n" +
          `    cause: ${adapterReadError} -> ${adapterReadError}\n` +
          "    leaked: hello-tool\n" +
          "    [skills] (rollback failed)\n" +
          "      cause: EACCES: permission denied, unlink 'data.txt'\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIM-03 / D-PL6-12: a dependency whose skills undo cannot finish gets its own redacted row", async (t) => {
    // arrange
    const { cwd, denyWrites, project, restoreWrites } = await createHermeticScopes(
      t,
      "install-dependency-rollback-partial",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", dependencies: ["bar"] },
      bar: { skill: "clean" },
    });
    const readOnly = path.join(marketplaceRoot, "plugins", "bar", "skills", "tool", "read-only");
    await writeUnder(path.join(readOnly, "data.txt"), "data\n");
    await denyWrites(readOnly);
    restoreWrites(path.join(project.extensionRoot, "resources", "skills", "bar-tool", "read-only"));
    await mkdir(project.mcpAdapterJsonPath, { recursive: true });
    const adapterReadError = await redactedReadErrorMessage(project.mcpAdapterJsonPath);
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ bar (failed) {rollback partial}\n" +
          `    cause: ${adapterReadError} -> ${adapterReadError}\n` +
          "    leaked: bar-tool\n" +
          "    [skills] (rollback failed)\n" +
          "      cause: EACCES: permission denied, unlink 'data.txt'\n" +
          "  ⊘ hello (failed) {dependency failed}\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.equal(await recordFor(project, "mp", "bar"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIM-03: a dependency two installs fail on with an unfinished undo gets one row", async (t) => {
    // arrange
    const { cwd, denyWrites, project, restoreWrites } = await createHermeticScopes(
      t,
      "install-shared-dependency-rollback-partial",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", dependencies: ["bar"] },
      world: { skill: "clean", dependencies: ["bar"] },
      bar: { skill: "clean" },
    });
    const readOnly = path.join(marketplaceRoot, "plugins", "bar", "skills", "tool", "read-only");
    await writeUnder(path.join(readOnly, "data.txt"), "data\n");
    await denyWrites(readOnly);
    restoreWrites(path.join(project.extensionRoot, "resources", "skills", "bar-tool", "read-only"));
    await mkdir(project.mcpAdapterJsonPath, { recursive: true });
    const adapterReadError = await redactedReadErrorMessage(project.mcpAdapterJsonPath);
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {}, "world@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    // The second install's skills undo leaves its read-only copy in a staging
    // directory whose name is random.
    const stagingRoot = path.join(project.extensionRoot, "skills-staging");
    for (const staging of await readdir(stagingRoot)) {
      restoreWrites(path.join(stagingRoot, staging, "bar-tool", "read-only"));
    }

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ bar (failed) {rollback partial}\n" +
          `    cause: ${adapterReadError} -> ${adapterReadError}\n` +
          "    leaked: bar-tool\n" +
          "    [skills] (rollback failed)\n" +
          "      cause: EACCES: permission denied, unlink 'data.txt'\n" +
          "  ⊘ hello (failed) {dependency failed}\n" +
          "  ⊘ world (failed) {dependency failed}\n" +
          "\n" +
          "Reconcile: 3 failures",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.equal(await recordFor(project, "mp", "world"), undefined);
    assert.equal(await recordFor(project, "mp", "bar"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIM-03: the undo of an earlier member the cascade installed rides the requested plugin's row", async (t) => {
    // arrange
    const { cwd, denyWrites, project, restoreWrites } = await createHermeticScopes(
      t,
      "install-sibling-rollback-partial",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", dependencies: ["alpha", "beta"] },
      alpha: { skill: "clean" },
      beta: { hooks: true },
    });
    const readOnly = path.join(marketplaceRoot, "plugins", "alpha", "skills", "tool", "read-only");
    await writeUnder(path.join(readOnly, "data.txt"), "data\n");
    await denyWrites(readOnly);
    restoreWrites(
      path.join(project.extensionRoot, "resources", "skills", "alpha-tool", "read-only"),
    );
    await writeUnder(project.hooksDir, "not a directory\n");
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "hello@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {dependency failed}\n" +
          "    [alpha@mp] (rollback failed)\n" +
          "      cause: EACCES: permission denied, unlink 'data.txt'\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "hello"), undefined);
    assert.equal(await recordFor(project, "mp", "beta"), undefined);
    verifyBoundary();
  });

  test("D-27: installs through a declared alias under the canonical recorded name and converges on the second pass", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "canonical-alias");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
      cwd,
      "canonical-src",
      "canonical-name",
      { formatter: { skill: "clean" } },
    );
    const declaration = configBytes({
      marketplaces: { "declared-name": { source: marketplaceRoot } },
      plugins: { "formatter@declared-name": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        "canonical-name": marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "canonical-name",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● canonical-name [project]\n" +
          "  ● formatter v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces), ["canonical-name"]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["canonical-name"]!.plugins), [
      "formatter",
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), afterFirst);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-27: an ambiguous alias source reports a conflict without changing canonical state", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "ambiguous-alias");
    const source = await writeMarketplaceSource(cwd, "canonical-src", "canonical-name", {});
    const declaration = configBytes({
      marketplaces: { "declared-name": { source: source.marketplaceRoot } },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    const initialState = {
      schemaVersion: 3 as const,
      marketplaces: {
        zeta: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "zeta",
          rawSource: source.marketplaceRoot,
          manifestPath: source.manifestPath,
          marketplaceRoot: source.marketplaceRoot,
        }),
        alpha: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "alpha",
          rawSource: source.marketplaceRoot,
          manifestPath: source.manifestPath,
          marketplaceRoot: source.marketplaceRoot,
        }),
      },
    };
    await seedState(project, initialState);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n" +
          "\n" +
          "⊘ declared-name [project] (failed) {source mismatch}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), initialState);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WARN-01: an install whose skill frontmatter cannot be parsed keeps the installed row, names the degrade, and reports the parse detail on the diagnostic channel", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-degraded");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      soft: { skill: "malformed", command: true },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "soft@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● soft v1.0.0 (installed) {malformed skill}\n" +
          "\n" +
          "Reconcile: 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
      {
        message:
          "1 post-install warning surfaced from reconcile installs.\n" +
          "\n" +
          "soft/soft-tool: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 20:\n" +
          "\n" +
          "name: [unterminated\n" +
          "                   ^\n",
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "soft"))?.resources.skills, [
      "soft-tool",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SURF-05: an install whose hook declares a rewake message without the asynchronous flag names the orphan on its installed row", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-orphan");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      orphan: { orphanRewakeHooks: true, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "orphan@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const ownerRuntime = createHooksRuntime();
    const peerRuntime = createHooksRuntime();
    const hooksRouting = createHooksRouting(ownerRuntime, { readHooksJson });

    // act
    await applyReconcileWithRouting({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      gitOps,
      hooksRouting,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ● orphan v1.0.0 (installed) {orphan rewake}\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "orphan"))?.resources.hooks, ["orphan"]);
    assert.deepStrictEqual(
      ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
      ["orphan"],
    );
    assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SEV-01: an install that stages an agent and a server declares both companions on its row", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-companions");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      rich: { agents: ["with-tools"], mcpServer: true, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "rich@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● rich v1.0.0 (installed) {requires pi-subagents, requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "rich"))?.resources.mcpServers, [
      "echo",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  for (const mode of ["json", "rpc"]) {
    test(`appends reconcile diagnostics after committed installs in ${mode}`, async (t) => {
      // arrange
      const { cwd, project } = await createHermeticScopes(t, "machine-install-warnings");
      const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
        duo: { agents: ["with-mcp-servers", "with-mcp-servers"] },
      });
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({
          marketplaces: { mp: { source: marketplaceRoot } },
          plugins: { "duo@mp": {} },
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {
          mp: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "mp",
            rawSource: marketplaceRoot,
            manifestPath,
            marketplaceRoot,
          }),
        },
      });
      const capture = createJsonCapture();
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };
      const inventory = mock<
        Pick<Parameters<typeof openNotificationRun>[0], "getAllTools" | "getCommands">
      >({
        exactParams: true,
        name: "inventory",
      });
      when(() => inventory.getAllTools())
        .thenReturn([])
        .times(3);
      when(() => inventory.getCommands())
        .thenReturn([])
        .once();
      const pi = {
        getAllTools: () => inventory.getAllTools(),
        getCommands: () => inventory.getCommands(),
        appendEntry: capture.entrySink.appendEntry,
      };
      const run = openNotificationRun(pi, {
        kind: "command",
        commandId: "plugin",
        invocationId: "test-run",
      });
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run, cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual((await recordFor(project, "mp", "duo"))?.resources.agents, [
        "pi-claude-marketplace-duo-bot0",
        "pi-claude-marketplace-duo-bot1",
      ]);
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "reconcile-applied-cascade",
            severity: "info",
            needsReload: true,
            tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
            marketplaces: [
              {
                name: "mp",
                scope: "project",
                plugins: [
                  {
                    name: "duo",
                    id: "duo@mp",
                    scope: "project",
                    status: "installed",
                    version: "1.0.0",
                    reasons: ["requires pi-subagents"],
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
            header: "2 post-install warnings surfaced from reconcile installs.",
            lines: [
              '[bot0] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["duo:bot0"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
              '[bot1] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["duo:bot1"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
            ],
          },
        },
      ]);
      assert.deepStrictEqual(clonedUrls(), []);
      capture.assertValid();
      assert.strictEqual(run.entrySink, pi);
      verify(inventory);
    });
  }

  test("retains a caught malformed diagnostic after the reconcile install commits", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "caught-diagnostic");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      duo: { agents: ["with-mcp-servers"] },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "duo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const capture = createJsonCapture();
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };
    const failures: unknown[] = [];
    const run = {
      ...runWithNothingLoaded(),
      entrySink: {
        appendEntry(customType: string, payload: unknown): void {
          try {
            capture.entrySink.appendEntry(customType, capture.entries.length === 1 ? {} : payload);
          } catch (error: unknown) {
            failures.push(error);
          }
        },
      },
    };
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual((await recordFor(project, "mp", "duo"))?.resources.agents, [
      "pi-claude-marketplace-duo-bot0",
    ]);
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "reconcile-applied-cascade",
          severity: "info",
          needsReload: true,
          tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                {
                  name: "duo",
                  id: "duo@mp",
                  scope: "project",
                  status: "installed",
                  version: "1.0.0",
                  reasons: ["requires pi-subagents"],
                },
              ],
            },
          ],
        },
      },
      { customType: "claude-plugin", payload: {} },
    ]);
    assert.strictEqual(failures.length, 1);
    assert.ok(failures[0] instanceof assert.AssertionError);
    assert.throws(() => {
      capture.assertValid();
    }, assert.AssertionError);
    assert.deepStrictEqual(clonedUrls(), []);
  });

  test("S2: two agents with dropped mcpServers raise the plural post-install warning header", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-warnings");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      duo: { agents: ["with-mcp-servers", "with-mcp-servers"] },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "duo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● duo v1.0.0 (installed) {requires pi-subagents}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "2 post-install warnings surfaced from reconcile installs.\n" +
          "\n" +
          '[bot0] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["duo:bot0"].tools (e.g. read,bash,mcp:<server>) in Pi settings.\n' +
          '[bot1] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["duo:bot1"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("DFEN-04: a bare declaration under an entry that defaults to disabled installs, unstages, names the cause and the remedy, and stamps the declaring base config", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-disabled-base");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      quiet: { entryDefaultEnabled: false, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "quiet"))?.enabled, false);
    assert.deepStrictEqual(JSON.parse(await readFile(project.baseConfigJsonPath, "utf8")), {
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "quiet@mp": { enabled: false } },
    });
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/data/",
      "pi-claude-marketplace/data/mp/",
      "pi-claude-marketplace/data/mp/quiet/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("DFEN-05: the same declaration made only in the local config stamps the local config and leaves the base config byte-identical", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-disabled-local");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      quiet: { entryDefaultEnabled: false, skill: "clean" },
    });
    const baseDeclaration = configBytes({ marketplaces: { mp: { source: marketplaceRoot } } });
    await writeUnder(project.baseConfigJsonPath, baseDeclaration);
    // LAYER-06: the local layer declares the marketplace of its plugin too.
    await writeUnder(
      project.localConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), baseDeclaration);
    assert.deepStrictEqual(JSON.parse(await readFile(project.localConfigJsonPath, "utf8")), {
      schemaVersion: 1,
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "quiet@mp": { enabled: false } },
    });
    assert.equal((await recordFor(project, "mp", "quiet"))?.enabled, false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  const installFaultPositions = [
    {
      name: "first",
      keys: ["gone", "mike", "alfa"],
      rows: "  ⊘ gone (failed) {source missing}\n  ● mike v1.0.0 (installed)\n  ● alfa v1.0.0 (installed)",
    },
    {
      name: "middle",
      keys: ["mike", "gone", "alfa"],
      rows: "  ● mike v1.0.0 (installed)\n  ⊘ gone (failed) {source missing}\n  ● alfa v1.0.0 (installed)",
    },
  ] as const satisfies readonly {
    readonly name: string;
    readonly keys: readonly string[];
    readonly rows: string;
  }[];

  for (const { name, keys, rows } of installFaultPositions) {
    test(`RECON-03: an install whose source tree is missing fails in ${name} position and the rest of the batch still installs`, async (t) => {
      // arrange
      const { cwd, project } = await createHermeticScopes(t, `install-fault-${name}`);
      const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
        alfa: { skill: "clean" },
        gone: { skill: "clean" },
        mike: { skill: "clean" },
      });
      await rm(path.join(marketplaceRoot, "plugins", "gone"), { force: true, recursive: true });
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({
          marketplaces: { mp: { source: marketplaceRoot } },
          plugins: Object.fromEntries(keys.map((key) => [`${key}@mp`, {}])),
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {
          mp: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "mp",
            rawSource: marketplaceRoot,
            manifestPath,
            marketplaceRoot,
          }),
        },
      });
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n" +
            "\n" +
            "● mp [project]\n" +
            `${rows}\n` +
            "\n" +
            "Reconcile: 1 failure, 2 successes\n" +
            "\n" +
            "/reload to pick up changes",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(
        Object.keys(
          (await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {},
        ).sort(),
        ["alfa", "mike"],
      );
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("ENBL-02: a recorded-but-disabled plugin declared enabled is re-materialized and keeps its recorded version", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "enable-clean");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: { "hello@mp": {} },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({
              enabled: false,
              pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ● hello v1.0.0 (installed)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
    ]);
    const record = await recordFor(project, "mp", "hello");
    assert.equal(record?.enabled, true);
    assert.equal(record?.version, "1.0.0");
    assert.deepStrictEqual(record?.resources.skills, ["hello-tool"]);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  const enableSignalRows = [
    {
      name: "declares both companions when the ledger stages an agent and a server",
      tree: { agents: ["with-tools"], mcpServer: true, skill: "clean" },
      row: "  ● hello v1.0.0 (installed) {requires pi-subagents, requires pi-mcp-adapter}",
      severity: undefined,
      summary: "",
      tally: "Reconcile: 1 success",
    },
    {
      name: "declares the workflows companion when the ledger stages a script",
      tree: { workflow: true, skill: "clean" },
      row: "  ● hello v1.0.0 (installed) {requires pi-dynamic-workflows}",
      severity: undefined,
      summary: "",
      tally: "Reconcile: 1 success",
    },
    {
      name: "names the degraded component when the skill frontmatter cannot be parsed",
      tree: { command: true, skill: "malformed" },
      row: "  ● hello v1.0.0 (installed) {malformed skill}",
      severity: "warning",
      summary: "A plugin operation needs attention.\n\n",
      tally: "Reconcile: 1 warning",
    },
    {
      name: "names the orphaned rewake when a hook declares one without the asynchronous flag",
      tree: { orphanRewakeHooks: true, skill: "clean" },
      row: "  ● hello v1.0.0 (installed) {orphan rewake}",
      severity: undefined,
      summary: "",
      tally: "Reconcile: 1 success",
    },
  ] as const satisfies readonly {
    readonly name: string;
    readonly tree: PluginTree;
    readonly row: string;
    readonly severity: "warning" | undefined;
    readonly summary: string;
    readonly tally: string;
  }[];

  for (const { name, tree, row, severity, summary, tally } of enableSignalRows) {
    test(`ENBL-07: a load-time enable ${name}`, async (t) => {
      // arrange
      const { cwd, project } = await createHermeticScopes(t, "enable-signals");
      const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
        hello: tree,
      });
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({
          marketplaces: { mp: { source: marketplaceRoot } },
          plugins: { "hello@mp": {} },
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {
          mp: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "mp",
            rawSource: marketplaceRoot,
            manifestPath,
            marketplaceRoot,
            plugins: {
              hello: pluginRecord({
                enabled: false,
                pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
              }),
            },
          }),
        },
      });
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `${summary}● mp [project]\n${row}\n\n${tally}\n\n/reload to pick up changes`,
          ...(severity !== undefined && { severity }),
        },
      ]);
      assert.equal((await recordFor(project, "mp", "hello"))?.enabled, true);
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("ENBL-07: enabling a record already marked not installable re-materializes it partially and names the dropped kind", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "enable-partial");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { lsp: true, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "hello@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({
              enabled: false,
              installable: false,
              pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
              supported: ["skills"],
              unsupported: ["lspServers"],
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ◉ hello v1.0.0 (partially-installed) {lsp}\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "hello"))?.enabled, true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-07: an enable whose marketplace clone is gone reports source missing and changes no record", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "enable-failed");
    const vanished = path.join(cwd, "vanished");
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: vanished } },
        plugins: { "hello@mp": {} },
      }),
    );
    const seeded: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: vanished,
          manifestPath: path.join(vanished, ".claude-plugin", "marketplace.json"),
          marketplaceRoot: vanished,
          plugins: {
            hello: pluginRecord({
              enabled: false,
              pluginRoot: path.join(vanished, "plugins", "hello"),
            }),
          },
        }),
      },
    };
    await seedState(project, seeded);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {source missing}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-18: a plugin declared disabled is unstaged while a sibling whose unstage is refused reports its own row", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "disable-mixed");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      alfa: { skill: "clean" },
      zulu: { hooks: true },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": { enabled: false }, "zulu@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            alfa: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "alfa"),
              skills: ["alfa-tool"],
            }),
            zulu: pluginRecord({
              hooks: ["zulu"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "zulu"),
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "alfa-tool", "SKILL.md"),
      "---\nname: alfa-tool\n---\n\nbody\n",
    );
    await writeUnder(
      path.join(project.extensionRoot, "hooks", "zulu", "hooks.json"),
      JSON.stringify({ PreToolUse: [] }),
    );
    await denyWrites(path.join(project.extensionRoot, "hooks", "zulu"));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ alfa v1.0.0 (disabled)\n" +
          "  ⊘ zulu (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "alfa"))?.enabled, false);
    assert.equal((await recordFor(project, "mp", "zulu"))?.enabled, true);
    assert.deepStrictEqual((await recordFor(project, "mp", "alfa"))?.resources.skills, [
      "alfa-tool",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("PURL-06: every planner diagnostic cause renders on the cascade, and only the dangling reference attributes a plugin child", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mismatch");
    const recorded = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    const declared = await writeMarketplaceSource(cwd, "other-src", "other", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: {
          mp: { source: declared.marketplaceRoot },
          weird: { source: path.join(cwd, "weird") },
        },
        plugins: { "cr@phantom": {}, nokey: {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: recorded.marketplaceRoot,
          manifestPath: recorded.manifestPath,
          marketplaceRoot: recorded.marketplaceRoot,
        }),
        weird: {
          ...marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "weird",
            rawSource: path.join(cwd, "weird"),
            manifestPath: path.join(cwd, "weird", ".claude-plugin", "marketplace.json"),
            marketplaceRoot: path.join(cwd, "weird"),
          }),
          // An unrecognized stored source string is what the planner reports as
          // an unknown recorded source rather than as a byte mismatch.
          source: { kind: "unknown", raw: "??::??" },
        },
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {invalid manifest}\n" +
          "\n" +
          "⊘ nokey [project] (failed) {source mismatch}\n" +
          "\n" +
          "⊘ phantom [project] (failed) {dangling reference}\n" +
          "  ⊘ cr (failed) {dangling reference}\n" +
          "\n" +
          "⊘ weird [project] (failed) {source mismatch}\n" +
          "\n" +
          "Reconcile: 5 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces).sort(),
      ["mp", "weird"],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL6-19: a local-layer source change re-adds the marketplace in place and converges", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "source-replace-local");
    const oldSource = await writeMarketplaceSource(cwd, "old-tools", "tools", {});
    const newSource = await writeMarketplaceSource(cwd, "new-tools", "tools", {});
    const baseBytes = configBytes({ marketplaces: {} });
    const localBytes = configBytes({
      marketplaces: { tools: { source: newSource.marketplaceRoot } },
    });
    await writeUnder(project.baseConfigJsonPath, baseBytes);
    await writeUnder(project.localConfigJsonPath, localBytes);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        tools: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "tools",
          rawSource: oldSource.marketplaceRoot,
          manifestPath: oldSource.manifestPath,
          marketplaceRoot: oldSource.marketplaceRoot,
        }),
      },
    });
    const first = createNotificationBoundary(1);
    const second = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    await applyReconcile({
      ctx: second.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(first.notifications, [
      { message: "● tools [project] (added)\n\nReconcile: 1 success" },
    ]);
    assert.deepStrictEqual(second.notifications, [APPLY_EMPTY_NOTICE]);
    const record = (await loadState(project.extensionRoot)).marketplaces.tools;
    assert.deepStrictEqual(record?.source, pathSource(newSource.marketplaceRoot));
    assert.equal(record?.manifestPath, newSource.manifestPath);
    assert.equal(record?.marketplaceRoot, newSource.marketplaceRoot);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), baseBytes);
    assert.equal(await readFile(project.localConfigJsonPath, "utf8"), localBytes);
    assert.deepStrictEqual(clonedUrls(), []);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("a source repair clones its replacement once and reports one added marketplace", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "source-replace-remote");
    const oldSource = await writeMarketplaceSource(cwd, "old-tools", "tools", {});
    const newSource = await writeMarketplaceSource(cwd, "new-tools", "tools", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { tools: { source: "acme/tools" } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        tools: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "tools",
          rawSource: oldSource.marketplaceRoot,
          manifestPath: oldSource.manifestPath,
          marketplaceRoot: oldSource.marketplaceRoot,
        }),
      },
    });
    const boundary = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/tools.git"],
      fixtureSourceDir: newSource.marketplaceRoot,
    });

    // act
    await applyReconcile({
      ctx: boundary.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● tools [project] (added)\n\nReconcile: 1 success" },
    ]);
    assert.deepStrictEqual(clonedUrls(), ["https://github.com/acme/tools.git"]);
    boundary.verifyBoundary();
  });

  test("D-PL6-19: the official fallback source is already up to date", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "official-source-fallback");
    const recorded = await writeMarketplaceSource(
      cwd,
      "official-mirror",
      "claude-plugins-official",
      {},
    );
    const declaration = configBytes({
      marketplaces: {
        "claude-plugins-official": { source: "anthropics/claude-plugins-official" },
      },
    });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        "claude-plugins-official": marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "claude-plugins-official",
          rawSource: recorded.marketplaceRoot,
          manifestPath: recorded.manifestPath,
          marketplaceRoot: recorded.marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(
      (await loadState(project.extensionRoot)).marketplaces["claude-plugins-official"]?.source,
      pathSource(recorded.marketplaceRoot),
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: both scopes reconcile in one invocation and share a single cascade, project before user", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "fan-out");
    const projectSource = await writeMarketplaceSource(cwd, "p-src", "p-mp", {});
    const userSource = await writeMarketplaceSource(cwd, "u-src", "u-mp", {});
    const projectConfig = configBytes({
      marketplaces: { "p-mp": { source: projectSource.marketplaceRoot } },
    });
    const userConfig = configBytes({
      marketplaces: { "u-mp": { source: userSource.marketplaceRoot } },
    });
    await writeUnder(project.baseConfigJsonPath, projectConfig);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(user.baseConfigJsonPath, userConfig);
    await seedState(user, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(path.join(project.scopeRoot, "unrelated.txt"), "project bytes\n");
    await writeUnder(path.join(user.scopeRoot, "unrelated.txt"), "user bytes\n");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const startedAt = Date.now();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, gitOps });
    const completedAt = Date.now();

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● p-mp [project] (added)\n\n● u-mp [user] (added)\n\nReconcile: 2 successes",
      },
    ]);
    const projectState = await loadState(project.extensionRoot);
    const userState = await loadState(user.extensionRoot);
    const projectRecord = projectState.marketplaces["p-mp"];
    const userRecord = userState.marketplaces["u-mp"];
    if (projectRecord === undefined || userRecord === undefined) {
      assert.fail("Both scope records must be persisted before their full values are compared.");
    }

    const projectUpdatedAt = Date.parse(projectRecord.lastUpdatedAt ?? "");
    const userUpdatedAt = Date.parse(userRecord.lastUpdatedAt ?? "");
    assert.equal(projectUpdatedAt >= startedAt && projectUpdatedAt <= completedAt, true);
    assert.equal(userUpdatedAt >= startedAt && userUpdatedAt <= completedAt, true);
    assert.deepStrictEqual(projectState, {
      schemaVersion: 3,
      marketplaces: {
        "p-mp": {
          ...marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "p-mp",
            rawSource: projectSource.marketplaceRoot,
            manifestPath: projectSource.manifestPath,
            marketplaceRoot: projectSource.marketplaceRoot,
          }),
          lastSuccessfulManifest: JSON.stringify({ name: "p-mp", plugins: [] }),
          lastUpdatedAt: projectRecord.lastUpdatedAt,
        },
      },
    });
    assert.deepStrictEqual(userState, {
      schemaVersion: 3,
      marketplaces: {
        "u-mp": {
          ...marketplaceRecord({
            cwd,
            scope: "user",
            marketplace: "u-mp",
            rawSource: userSource.marketplaceRoot,
            manifestPath: userSource.manifestPath,
            marketplaceRoot: userSource.marketplaceRoot,
          }),
          lastSuccessfulManifest: JSON.stringify({ name: "u-mp", plugins: [] }),
          lastUpdatedAt: userRecord.lastUpdatedAt,
        },
      },
    });
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), projectConfig);
    assert.equal(await readFile(user.baseConfigJsonPath, "utf8"), userConfig);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
      "unrelated.txt",
    ]);
    assert.deepStrictEqual(await retryTree(user.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
      "unrelated.txt",
    ]);
    assert.equal(
      await readFile(path.join(project.scopeRoot, "unrelated.txt"), "utf8"),
      "project bytes\n",
    );
    assert.equal(
      await readFile(path.join(user.scopeRoot, "unrelated.txt"), "utf8"),
      "user bytes\n",
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: both scopes are driven project first, in the order their clones are taken", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "fan-out-order");
    const fixture = await writeMarketplaceSource(cwd, "remote-src", "remote-mp", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/proj" } } }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(
      user.baseConfigJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/user" } } }),
    );
    await seedState(user, {
      schemaVersion: 3,
      marketplaces: {},
    });
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/proj.git", "https://github.com/acme/user.git"],
      fixtureSourceDir: fixture.marketplaceRoot,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● remote-mp [project] (added)\n" +
          "\n" +
          "● remote-mp [user] (added)\n" +
          "\n" +
          "Reconcile: 2 successes",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), [
      "https://github.com/acme/proj.git",
      "https://github.com/acme/user.git",
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(project.extensionRoot)).marketplaces), [
      "remote-mp",
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(user.extensionRoot)).marketplaces), [
      "remote-mp",
    ]);
    verifyBoundary();
  });

  test("RECON-01: a marketplace and a plugin declared together in one pass are added and then installed into", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "add-then-install");
    const { marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "hello@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] (added)\n" +
          "  ● hello v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "hello"))?.resources.skills, [
      "hello-tool",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: an explicit scope reconciles that scope alone and leaves the sibling scope untouched", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "explicit-scope");
    const projectSource = await writeMarketplaceSource(cwd, "p-src", "p-mp", {});
    const userSource = await writeMarketplaceSource(cwd, "u-src", "u-mp", {});
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { "p-mp": { source: projectSource.marketplaceRoot } } }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(
      user.baseConfigJsonPath,
      configBytes({ marketplaces: { "u-mp": { source: userSource.marketplaceRoot } } }),
    );
    const userState: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {},
    };
    await seedState(user, userState);
    const userStateBytes = await readFile(user.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● p-mp [project] (added)\n\nReconcile: 1 success" },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(project.extensionRoot)).marketplaces), [
      "p-mp",
    ]);
    assert.equal(await readFile(user.stateJsonPath, "utf8"), userStateBytes);
    assert.deepStrictEqual(await retryTree(user.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-05 / D-08: two consecutive reconciles over a converged scope report nothing to change and leave both files byte-identical and untouched", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "converged");
    const declaration = configBytes({ marketplaces: {}, plugins: {} });
    await writeUnder(project.baseConfigJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const configModifiedAt = (await stat(project.baseConfigJsonPath)).mtimeMs;
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE, APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(project.baseConfigJsonPath)).mtimeMs, configModifiedAt);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, stateModifiedAt);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("BFILL-01 / D-13: one cascade carries a growth row beside a fresh install row, ends with the reload trailer and leaves the old stamp as written", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "promotion");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      fresh: { skill: "clean" },
      promoted: { command: true, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "fresh@mp": {}, "promoted@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      // D-13: an old stamp gates nothing and stays as written.
      lastReconciledExtensionVersion: "0.0.0",
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            promoted: pluginRecord({
              installable: false,
              pluginRoot: path.join(marketplaceRoot, "plugins", "promoted"),
              skills: ["promoted-tool"],
              supported: ["skills"],
              unsupported: ["commands"],
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● fresh v1.0.0 (installed)\n" +
          // WCONV-03: the promotion row says why it appeared; the fresh install
          // beside it has no such brace, which is the whole point of the marker.
          "  ● promoted v1.0.0 (installed) {components now supported}\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await loadState(project.extensionRoot)).lastReconciledExtensionVersion, "0.0.0");
    assert.deepStrictEqual((await recordFor(project, "mp", "promoted"))?.resources.prompts, [
      "promoted:deploy",
    ]);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/commands-staging/",
      "pi-claude-marketplace/data/",
      "pi-claude-marketplace/data/mp/",
      "pi-claude-marketplace/data/mp/fresh/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/prompts/",
      "pi-claude-marketplace/resources/prompts/promoted:deploy.md",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/fresh-tool/",
      "pi-claude-marketplace/resources/skills/fresh-tool/SKILL.md",
      "pi-claude-marketplace/resources/skills/promoted-tool/",
      "pi-claude-marketplace/resources/skills/promoted-tool/SKILL.md",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-05 / D-08: a scope that declares a configuration but has never recorded state reports nothing to change and gains no state file", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "config-only");
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {}, plugins: {} }));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
  test("S2 / DFEN-04: an install that lands disabled still reports the hygiene warnings its ledger produced", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "disabled-warnings");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      quiet: { agents: ["with-mcp-servers"], entryDefaultEnabled: false, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "1 post-install warning surfaced from reconcile installs.\n" +
          "\n" +
          '[bot0] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["quiet:bot0"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
        severity: "warning",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "quiet"))?.enabled, false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-03: a marketplace removal whose scope resolution meets a half-written state file reports a failed row instead of aborting the reconcile", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "remove-throw");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    });
    const applyWithRace = applyAfterSelectedStateRace(project, "{ half written");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {unreadable}\n" +
          "\n" +
          "⊘ state.json [project] (failed) {unparseable}\n" +
          "  ⊘ state.json (failed) {unparseable}\n" +
          "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
          "\n" +
          "Reconcile: 3 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-03: a plugin uninstall whose target resolution meets a half-written state file reports a failed row instead of aborting the reconcile", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-throw");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "hello") }),
          },
        }),
      },
    });
    const applyWithRace = applyAfterSelectedStateRace(project, "{ half written");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const completionCache = createCompletionCache();
    const pluginCachePath = await project.pluginCacheFile("mp");
    await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () =>
      Promise.resolve([{ name: "hello", status: "installed" }]),
    );
    await rm(path.dirname(path.dirname(pluginCachePath)), { force: true, recursive: true });
    const beforeTree = await retryTree(project.scopeRoot);

    // act
    await applyWithRace({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache,
      gitOps,
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });
    const retainedRows = await completionCache.getPluginIndex(
      pluginCachePath,
      "project",
      "mp",
      () => Promise.reject(new Error("failed uninstall must preserve its completion rows")),
    );

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {unreadable}\n" +
          "\n" +
          "⊘ state.json [project] (failed) {unparseable}\n" +
          "  ⊘ state.json (failed) {unparseable}\n" +
          "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
          "\n" +
          "Reconcile: 3 failures",
        severity: "error",
      },
    ]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), "{ half written");
    assert.deepStrictEqual(await retryTree(project.scopeRoot), beforeTree);
    assert.deepStrictEqual(retainedRows, [{ name: "hello", status: "installed" }]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-02: a selected project snapshot races a competing removal while the user scope still completes", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "remove-converged");
    const projectSource = await writeMarketplaceSource(cwd, "project-mp-src", "mp", {});
    const userSource = await writeMarketplaceSource(cwd, "user-mp-src", "mp", {});
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(user.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    const projectRecorded: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: projectSource.marketplaceRoot,
          manifestPath: projectSource.manifestPath,
          marketplaceRoot: projectSource.marketplaceRoot,
        }),
      },
    };
    const userRecorded: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "user",
          marketplace: "mp",
          rawSource: userSource.marketplaceRoot,
          manifestPath: userSource.manifestPath,
          marketplaceRoot: userSource.marketplaceRoot,
        }),
      },
    };
    await seedState(project, projectRecorded);
    await seedState(user, userRecorded);
    await writeUnder(path.join(project.scopeRoot, "unrelated.txt"), "project bytes\n");
    await writeUnder(path.join(user.scopeRoot, "unrelated.txt"), "user bytes\n");
    const readerRoots: string[] = [];
    const reader: ReconcileStateReader = {
      async loadState(extensionRoot) {
        const selected = await loadState(extensionRoot);
        readerRoots.push(extensionRoot);
        if (extensionRoot === project.extensionRoot) {
          await saveState(extensionRoot, { ...selected, marketplaces: {} });
        }

        return selected;
      },
    };
    const applyWithReader = createApplyReconcile(reader);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();

    // act
    await applyWithReader({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      completionCache,
      gitOps,
      hooksRouting,
    });
    await applyWithReader({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      completionCache,
      gitOps,
      hooksRouting,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {not found}\n" +
          "\n" +
          "● mp [user] (removed)\n" +
          "\n" +
          "Reconcile: 1 failure, 1 success",
        severity: "error",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    const expectedProjectState: ExtensionState = {
      ...projectRecorded,
      marketplaces: {},
    };
    const expectedUserState: ExtensionState = {
      ...userRecorded,
      marketplaces: {},
    };
    assert.deepStrictEqual(await loadState(project.extensionRoot), expectedProjectState);
    assert.deepStrictEqual(await loadState(user.extensionRoot), expectedUserState);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
      "unrelated.txt",
    ]);
    assert.deepStrictEqual(await retryTree(user.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
      "unrelated.txt",
    ]);
    assert.equal(
      await readFile(path.join(project.scopeRoot, "unrelated.txt"), "utf8"),
      "project bytes\n",
    );
    assert.equal(
      await readFile(path.join(user.scopeRoot, "unrelated.txt"), "utf8"),
      "user bytes\n",
    );
    assert.deepStrictEqual(clonedUrls(), []);
    // Each pass reads each scope twice through the selected-state reader: the
    // read pass, then the catalog convergence over the scope it left (D-08).
    assert.deepStrictEqual(readerRoots, [
      project.extensionRoot,
      project.extensionRoot,
      user.extensionRoot,
      user.extensionRoot,
      project.extensionRoot,
      project.extensionRoot,
      user.extensionRoot,
      user.extensionRoot,
    ]);
    verifyBoundary();
  });

  test("WR-06: a planned uninstall whose record another process already removed converges without a row", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-converged");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    const competingState: ExtensionState = {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
        }),
      },
    };
    await seedState(project, {
      ...competingState,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            hello: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "hello") }),
          },
        }),
      },
    });
    const applyWithRace = applyAfterSelectedStateRace(project, competingState);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.strictEqual(await recordFor(project, "mp", "hello"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
  test("LOAD-01: a plugin whose declared dependency is not recorded is disabled, stamped and unstaged", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-missing");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    const declaration = await readFile(project.baseConfigJsonPath, "utf8");
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
              skills: ["deploy-kit-tool"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "deploy-kit-tool", "SKILL.md"),
      "---\nname: deploy-kit-tool\n---\n\nbody\n",
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u2298 secrets-vault (failed) {not in manifest}\n" +
          "  \u25cd deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, false);
    assert.equal(record?.dependencyDisabled, true);
    assert.equal(await pathExists(path.join(project.skillsTargetDir, "deploy-kit-tool")), false);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("CR-01: a throwing marker stamp keeps the dependency-disable row on the cascade", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-stamp-throws");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
              skills: ["deploy-kit-tool"],
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.skillsTargetDir, "deploy-kit-tool", "SKILL.md"),
      "---\nname: deploy-kit-tool\n---\n\nbody\n",
    );
    const stampDependencyDisabled = (): Promise<void> => {
      throw new StateLockHeldError("project", ".state-lock");
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      stampDependencyDisabled,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ secrets-vault (failed) {not in manifest}\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "⊘ state.json [project] (failed) {lock held}\n" +
          "  ⊘ state.json (failed) {lock held}\n" +
          "    cause: Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.\n" +
          "\n" +
          "Reconcile: 3 failures, 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, false);
    assert.equal(Object.hasOwn(record ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-01 / D-08: a scope whose declarations are all satisfied reports nothing to change and leaves state.json untouched", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-satisfied");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "secrets-vault": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, stateModifiedAt);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-06-02 / D-PL2-18: a record disabled before the pass is held down without being stamped, and its move reports why it did not run", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-already-disabled");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              enabled: false,
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ secrets-vault (failed) {not in manifest}\n" +
          "  ⊘ deploy-kit v1.0.0 (skipped) {dependency failed}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 warning",
        severity: "error",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, false);
    assert.equal(Object.hasOwn(record ?? {}, "dependencyDisabled"), false);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, stateModifiedAt);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-02: a satisfied dependency lifts the hold and the marker leaves the record", async (t) => {
    // arrange -- the previous pass held deploy-kit down; secrets-vault is now
    // recorded and enabled, so the live verdict no longer names it.
    const { cwd, project } = await createHermeticScopes(t, "dependency-lifted");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              enabled: false,
              dependencyDisabled: true,
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "secrets-vault": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, true);
    // A key-presence check, not a truthiness one: the contract is that the
    // marker is GONE, and a key left behind set to false would read as a
    // record this check is still responsible for.
    assert.equal(Object.hasOwn(record ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "\u25cf mp [project]\n" +
          "  \u25cf deploy-kit v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(record?.resources.skills, ["deploy-kit-tool"]);
    assert.equal(await pathExists(path.join(project.skillsTargetDir, "deploy-kit-tool")), true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("GV-01: a missing plugin directory dependency outside its range fails as a version conflict naming its requirer", async (t) => {
    // arrange
    const directory = "anthropic-plugin-directory";
    const { cwd, project } = await createHermeticScopes(t, "dependency-directory-pin");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
      cwd,
      "mp-src",
      directory,
      {
        "deploy-kit": { dependencies: ["secrets-vault@^2.0.0"], skill: "clean" },
        "secrets-vault": { skill: "clean" },
      },
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { [directory]: { source: `anthropics/${directory}` } },
        plugins: { [`deploy-kit@${directory}`]: {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        [directory]: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: directory,
          rawSource: marketplaceRoot,
          source: {
            kind: "github",
            raw: `anthropics/${directory}`,
            owner: "anthropics",
            repo: directory,
          },
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    // D-PL2-01: the dependent's own catalog move (its supported set grew)
    // runs before the missing-dependency install; the judgement disables it
    // after the install's (failed) row (D-PL2-11).
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "\u25cf anthropic-plugin-directory [project]\n" +
          "  \u25cf deploy-kit v1.0.0 (installed) {components now supported}\n" +
          "  \u2298 secrets-vault (failed) {version conflict}\n" +
          '    cause: "secrets-vault" from the Anthropic Directory is pinned to its listed commit (version 1.0.0), which does not satisfy ^2.0.0 required by "deploy-kit".\n' +
          "  \u25cd deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@anthropic-plugin-directory" or uninstall "deploy-kit@anthropic-plugin-directory"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, directory, "secrets-vault"), undefined);
    verifyBoundary();
  });

  test("LOAD-02 / D-09-14: a second apply over an unchanged unsatisfied tree plans the retry bucket and retries the install", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-converges");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const first = createNotificationBoundary(1);
    const second = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    const settledBytes = await readFile(project.stateJsonPath, "utf8");
    const settledModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const replanned = await replanFromDisk(project);
    await applyReconcile({
      ctx: second.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- the plan is compared against the FACTORY, so a bucket added
    // later cannot slip past this case by being absent from a hand-written
    // literal. D-09-14: the dependency stays missing (mp never declared
    // secrets-vault), so the retry bucket re-plans the same entry every
    // pass -- a deliberate non-fixpoint. Every apply retries the install
    // (D-02), so the second pass reports the dependency's failure row alone
    // and writes nothing.
    assert.equal(first.notifications.length, 1);
    assert.deepStrictEqual(replanned, {
      ...emptyReconcilePlan("project"),
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "secrets-vault",
          marketplace: "mp",
          ranges: [],
          requiredBy: "deploy-kit@mp",
          declarers: ["deploy-kit@mp"],
        },
      ],
    });
    assert.deepStrictEqual(second.notifications, [SECRETS_VAULT_NOT_IN_MANIFEST]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, settledModifiedAt);
    assert.deepStrictEqual(clonedUrls(), []);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("D-08 / D-21: one apply disables a dependent along with the dependency the config disables", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-config-disabled");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "secrets-vault": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const first = createNotificationBoundary(1);
    const second = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    const replanned = await replanFromDisk(project);
    await applyReconcile({
      ctx: second.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(first.notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ secrets-vault v1.0.0 (disabled)\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Enable "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(replanned, emptyReconcilePlan("project"));
    assert.deepStrictEqual(second.notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal((await recordFor(project, "mp", "deploy-kit"))?.dependencyDisabled, true);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("LOAD-02: one pass propagates a broken dependency the full depth of a chain", async (t) => {
    // arrange -- alfa declares bravo, bravo declares the absent charlie. A
    // single non-repeating pass would need two reloads to reach alfa.
    const { cwd, project } = await createHermeticScopes(t, "dependency-chain");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      alfa: { dependencies: ["bravo"], skill: "clean" },
      bravo: { dependencies: ["charlie"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "bravo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            alfa: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "alfa") }),
            bravo: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "bravo") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert -- the exact set and the exact order, not "at least one row": the
    // fixpoint's sorted batch order puts bravo (held by the absent charlie)
    // before alfa (held by bravo), and an assertion that merely counted rows
    // would pass against an implementation that propagated nothing. D-PL2-01:
    // both moves (their supported sets grew) run before charlie's install,
    // and both disables follow its (failed) row (D-PL2-11).
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● bravo v1.0.0 (installed) {components now supported}\n" +
          "  ● alfa v1.0.0 (installed) {components now supported}\n" +
          "  ⊘ charlie (failed) {not in manifest}\n" +
          "  ◍ bravo v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "charlie@mp" or uninstall "bravo@mp"\n' +
          "  ◍ alfa v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Enable "bravo@mp" or uninstall "alfa@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 2 warnings, 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    const alfa = await recordFor(project, "mp", "alfa");
    const bravo = await recordFor(project, "mp", "bravo");
    assert.deepStrictEqual(
      { alfa: alfa?.enabled, bravo: bravo?.enabled },
      { alfa: false, bravo: false },
    );
    // D-09-14: charlie stays missing (mp never declared it), so the retry
    // bucket re-plans the same entry -- a deliberate non-fixpoint.
    assert.deepStrictEqual(await replanFromDisk(project), {
      ...emptyReconcilePlan("project"),
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "charlie",
          marketplace: "mp",
          ranges: [],
          requiredBy: "bravo@mp",
          declarers: ["bravo@mp"],
        },
      ],
    });
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-02: restoring the dependency lifts the whole chain in one pass", async (t) => {
    // arrange -- the settled state of the case above, plus charlie back.
    const { cwd, project } = await createHermeticScopes(t, "dependency-chain-lift");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      alfa: { dependencies: ["bravo"], skill: "clean" },
      bravo: { dependencies: ["charlie"], skill: "clean" },
      charlie: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "bravo@mp": {}, "charlie@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            alfa: pluginRecord({
              enabled: false,
              dependencyDisabled: true,
              pluginRoot: path.join(marketplaceRoot, "plugins", "alfa"),
            }),
            bravo: pluginRecord({
              enabled: false,
              dependencyDisabled: true,
              pluginRoot: path.join(marketplaceRoot, "plugins", "bravo"),
            }),
            charlie: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "charlie"),
            }),
          },
        }),
      },
    });
    const first = createNotificationBoundary(1);
    const second = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    const settledBytes = await readFile(project.stateJsonPath, "utf8");
    await applyReconcile({
      ctx: second.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    const alfa = await recordFor(project, "mp", "alfa");
    const bravo = await recordFor(project, "mp", "bravo");
    assert.deepStrictEqual(
      {
        alfaEnabled: alfa?.enabled,
        alfaMarked: Object.hasOwn(alfa ?? {}, "dependencyDisabled"),
        bravoEnabled: bravo?.enabled,
        bravoMarked: Object.hasOwn(bravo ?? {}, "dependencyDisabled"),
      },
      { alfaEnabled: true, alfaMarked: false, bravoEnabled: true, bravoMarked: false },
    );
    assert.equal(first.notifications.length, 1);
    assert.deepStrictEqual(second.notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.deepStrictEqual(clonedUrls(), []);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("D-05-07 / REC-05: a declarer whose own manifest cannot be read is a warning with its cause and nothing in the scope is disabled", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-unreadable");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      alfa: { dependencies: ["secrets-vault"], skill: "clean" },
      broken: { skill: "clean" },
    });
    await writeUnder(
      path.join(marketplaceRoot, "plugins", "broken", ".claude-plugin", "plugin.json"),
      "{ truncated",
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "broken@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            alfa: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "alfa") }),
            broken: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "broken") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u2298 broken (failed) {unreadable manifest}\n" +
          "    cause: cannot read the dependencies of broken@mp: its own manifest is present but cannot be read\n" +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "alfa"))?.enabled, true);
    assert.equal((await recordFor(project, "mp", "broken"))?.enabled, true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
  test("REC-05: a declarer this pass disables still gets the warning that the check was lost", async (t) => {
    // arrange -- `gone` is recorded and enabled, its catalog no longer lists
    // it, and the config now declares it disabled.
    const { cwd, project } = await createHermeticScopes(t, "dependency-declarer-disabled");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      alfa: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "gone@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            alfa: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "alfa") }),
            gone: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "gone") }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u25cd gone v1.0.0 (disabled)\n" +
          "  \u2298 gone (failed) {not in manifest}\n" +
          "    cause: cannot read the dependencies of gone@mp: not declared by its marketplace, and its installed copy cannot be read\n" +
          "\n" +
          "Reconcile: 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "gone"))?.enabled, false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-01: a held-down plugin whose unstage is refused reports the failure and is not stamped", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "dependency-refused");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], hooks: true },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              hooks: ["deploy-kit"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    await writeUnder(
      path.join(project.extensionRoot, "hooks", "deploy-kit", "hooks.json"),
      JSON.stringify({ PreToolUse: [] }),
    );
    await denyWrites(path.join(project.extensionRoot, "hooks", "deploy-kit"));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u2298 secrets-vault (failed) {not in manifest}\n" +
          "  \u2298 deploy-kit (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, true);
    assert.equal(Object.hasOwn(record ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  // ───────────────────────────────────────────────────────────────────────
  // MISS-01 / MISS-02 / D-09-04 .. D-09-14: the dependency-install step
  // (`applyDependencyInstalls`), which every apply runs (D-02), and its D-09-07
  // re-plan (`refreshTogglePlan`).
  // ───────────────────────────────────────────────────────────────────────

  test("MISS-01 / D-02: a plain apply installs a missing declared dependency and the dependent stays enabled", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-install");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    const declaration = await readFile(project.baseConfigJsonPath, "utf8");
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const secretsVault = await recordFor(project, "mp", "secrets-vault");
    assert.equal(secretsVault?.provenance, "dependency");
    assert.equal(secretsVault?.enabled, true);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.equal(await readFile(project.baseConfigJsonPath, "utf8"), declaration);
    assert.equal(await pathExists(project.localConfigJsonPath), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-09: a malformed skill on the missing dependency surfaces a post-install warning", async (t) => {
    // arrange -- secrets-vault's own skill has unparseable frontmatter, which
    // degrades but does not fail the install (WARN-01), and the collected
    // hygiene warning rides the entry point's postCommitWarnings, gated on the
    // member whose key equals the bucket entry's own root key.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-malformed-skill");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "malformed" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- WARN-01: the root's own degradation signals ride the cascade row
    // (`{dependency installed, malformed skill}` at `warning`), same as a
    // config-driven install's malformed-skill row, plus the sanctioned second
    // post-commit diagnostic (RECON-04's one exception) naming the degrade's
    // free-text detail.
    assert.equal(notifications.length, 2);
    const [cascade, diagnostic] = notifications;
    assert.match(
      cascade?.message ?? "",
      /secrets-vault v1\.0\.0 \(installed\) \{dependency installed, malformed skill\}/,
    );
    assert.equal(cascade?.severity, "warning");
    assert.match(diagnostic?.message ?? "", /installed; 1 staging warning/);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SURF-05: an orphan-rewake hook on the missing dependency carries the token onto the root's row", async (t) => {
    // arrange -- same shape as the malformed-skill case, but the degradation
    // signal is SURF-05's orphan rewake rather than WARN-01's malformed
    // frontmatter. Unlike a malformed component, the orphan token moves no
    // severity channel (apply-outcomes.ts), so the row stays info.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-orphan-rewake");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { orphanRewakeHooks: true, skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed, orphan rewake}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("TAGS-02: a missing dependency that falls back to its current copy carries the token onto its row", async (t) => {
    // arrange -- deploy-kit declares secrets-vault with a REAL version
    // constraint (not the bare-token default, which is unconstrained and
    // never reaches the tag probe). secrets-vault's marketplace root carries
    // no `.git`, so the real (uninjected) tag probe's listing fails and
    // TAGS-02's fallback installs the current copy.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-current-copy");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [
          {
            name: "deploy-kit",
            version: "1.0.0",
            source: "./plugins/deploy-kit",
            dependencies: [{ name: "secrets-vault", version: "^1.0.0" }],
          },
          { name: "secrets-vault", version: "1.0.0", source: "./plugins/secrets-vault" },
        ],
      }),
    );
    await writeUnder(
      path.join(marketplaceRoot, "plugins", "deploy-kit", ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "deploy-kit",
        version: "1.0.0",
        dependencies: [{ name: "secrets-vault", version: "^1.0.0" }],
      }),
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed, dependency current copy}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-07: a marker-held dependent comes back up in the same apply", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-lift");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              enabled: false,
              dependencyDisabled: true,
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- the install row first (step 5), then the record-walk lift
    // (step 5a's fresh pluginsToEnable).
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "  ● deploy-kit v1.0.0 → v1.0.0 (updated) {components now supported}\n" +
          "  ● deploy-kit v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 3 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-07: a dependent whose missing dependency a config install lands stays enabled", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-config-install-keeps");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
              skills: ["deploy-kit-tool"],
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-08: a provenance-independent dependent comes back up in the same apply", async (t) => {
    // arrange -- app (explicit, config-declared) declares lib; lib
    // (provenance: "dependency", never named by config) declares core; core
    // is missing. Installing core lifts lib, and lib's own lift brings app
    // back up with it -- D-09-08's lift is provenance-independent and
    // classifyDeclaredPlugin's config-declared branch alone could never
    // reach lib.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-provenance-lift");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      app: { dependencies: ["lib"], skill: "clean" },
      lib: { dependencies: ["core"], skill: "clean" },
      core: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": {} },
      }),
    );
    await writeUnder(
      path.join(project.extensionRoot, "resources", "skills", "app-tool", "SKILL.md"),
      "---\nname: app-tool\ndescription: installed app\n---\n",
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            app: pluginRecord({
              enabled: false,
              dependencyDisabled: true,
              pluginRoot: path.join(marketplaceRoot, "plugins", "app"),
            }),
            lib: {
              ...pluginRecord({
                enabled: false,
                dependencyDisabled: true,
                pluginRoot: path.join(marketplaceRoot, "plugins", "lib"),
              }),
              provenance: "dependency",
            },
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- both app and lib reach pluginsToEnable through the D-09-08
    // record-walk lift; each waits on core's install and has a growth move, so
    // `apply` moves and enables them after that install, dependencies first
    // (D-PL2-16): lib, then app above it.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● core v1.0.0 (installed) {dependency installed}\n" +
          "  ● lib v1.0.0 → v1.0.0 (updated) {components now supported}\n" +
          "  ● lib v1.0.0 (installed)\n" +
          "  ● app v1.0.0 → v1.0.0 (updated) {components now supported}\n" +
          "  ● app v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 5 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const app = await recordFor(project, "mp", "app");
    const lib = await recordFor(project, "mp", "lib");
    assert.deepStrictEqual(
      {
        appEnabled: app?.enabled,
        appMarked: Object.hasOwn(app ?? {}, "dependencyDisabled"),
        libEnabled: lib?.enabled,
        libMarked: Object.hasOwn(lib ?? {}, "dependencyDisabled"),
      },
      { appEnabled: true, appMarked: false, libEnabled: true, libMarked: false },
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MISS-02: a dependency whose closure fails reports on its own row and the dependent is held down", async (t) => {
    // arrange -- secrets-vault declares crypto-core, which mp does not declare.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-closure-fail");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { dependencies: ["crypto-core"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● deploy-kit v1.0.0 (installed) {components now supported}\n" +
          "  ⊘ secrets-vault (failed) {dependency failed}\n" +
          '    cause: Dependency "crypto-core@mp" is not declared by its marketplace.\n' +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.dependencyDisabled, true);
    const [notification] = notifications;
    const body = (notification?.message ?? "").replace(/\n\n\/reload to pick up changes$/u, "");
    assert.ok(!body.includes("/"));
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MISS-02 / D-03-08: a dependency whose marketplace is not added fails with the cause naming the marketplace", async (t) => {
    // arrange -- deploy-kit declares { name: "secrets-vault", marketplace:
    // "other" }, and "other" is not added in either scope.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-mp-not-added");
    const { marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { skill: "clean" },
    });
    await writeUnder(
      path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
      JSON.stringify({
        name: "mp",
        plugins: [
          {
            name: "deploy-kit",
            version: "1.0.0",
            source: "./plugins/deploy-kit",
            dependencies: [{ name: "secrets-vault", marketplace: "other", version: "*" }],
          },
        ],
      }),
    );
    await writeUnder(
      path.join(marketplaceRoot, "plugins", "deploy-kit", ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "deploy-kit",
        version: "1.0.0",
        dependencies: [{ name: "secrets-vault", marketplace: "other", version: "*" }],
      }),
    );
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const beforeMarketplaces = Object.keys((await loadState(project.extensionRoot)).marketplaces);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    const [notification] = notifications;
    assert.equal(notifications.length, 1);
    assert.match(notification?.message ?? "", /requires marketplace "other", which is not added/);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces),
      beforeMarketplaces,
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIM-05: a missing dependency whose own dependency cannot roll back shows both rows", async (t) => {
    // arrange
    const { cwd, denyWrites, project, restoreWrites } = await createHermeticScopes(
      t,
      "missing-dependency-rollback-partial",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      app: { skill: "clean", dependencies: ["lib"] },
      lib: { skill: "clean", dependencies: ["bar"] },
      bar: { skill: "clean" },
    });
    const readOnly = path.join(marketplaceRoot, "plugins", "bar", "skills", "tool", "read-only");
    await writeUnder(path.join(readOnly, "data.txt"), "data\n");
    await denyWrites(readOnly);
    restoreWrites(path.join(project.extensionRoot, "resources", "skills", "bar-tool", "read-only"));
    await mkdir(project.mcpAdapterJsonPath, { recursive: true });
    const adapterReadError = await redactedReadErrorMessage(project.mcpAdapterJsonPath);
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            app: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "app"),
              skills: ["app-tool"],
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ bar (failed) {rollback partial}\n" +
          `    cause: ${adapterReadError} -> ${adapterReadError}\n` +
          "    leaked: bar-tool\n" +
          "    [skills] (rollback failed)\n" +
          "      cause: EACCES: permission denied, unlink 'data.txt'\n" +
          "  ⊘ lib (failed) {dependency failed}\n" +
          "  ⊘ app (failed) {unreadable}\n" +
          "\n" +
          "Reconcile: 3 failures",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "bar"), undefined);
    assert.equal(await recordFor(project, "mp", "lib"), undefined);
    assert.equal((await recordFor(project, "mp", "app"))?.enabled, true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MISS-02: a dependency its marketplace does not declare keeps its own ledger's token", async (t) => {
    // arrange -- reuses the LOAD-01 fixture's shape: deploy-kit declares
    // secrets-vault, and mp's manifest does not list it at all.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-not-in-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- the root's own ledger failure passes through unwrapped, no
    // cause line.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● deploy-kit v1.0.0 (installed) {components now supported}\n" +
          "  ⊘ secrets-vault (failed) {not in manifest}\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-14: a failed dependency install is retried on the next apply and the dependent's row is silent once down", async (t) => {
    // arrange -- the not-in-manifest fixture, reloaded twice.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-retry");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const first = createNotificationBoundary(1);
    const second = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    await applyReconcile({
      ctx: second.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- the second reload carries the same failure row; the disable
    // row is silent because deploy-kit is already down (idempotent).
    assert.equal(first.notifications.length, 1);
    assert.deepStrictEqual(second.notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ secrets-vault (failed) {not in manifest}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("D-09-04: a disabled recorded dependency is left alone by the apply", async (t) => {
    // arrange -- secrets-vault is recorded and disabled by the USER (no
    // marker); deploy-kit is enabled.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-disabled-left-alone");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "secrets-vault": pluginRecord({
              enabled: false,
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const before = await recordFor(project, "mp", "secrets-vault");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- no plugin-installed row (nothing was attempted); the LOAD-01
    // row carries the Enable remedy.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Enable "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    const after = await recordFor(project, "mp", "secrets-vault");
    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-06: a key the same pass installs from the config is found present and not installed twice", async (t) => {
    // arrange -- app (config-declared, not yet recorded) declares helper;
    // deploy-kit (recorded, enabled) also declares helper. app's own
    // cascade materializes helper first; the dependency step must find it
    // already recorded and skip it silently.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-already-present");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      app: { dependencies: ["helper"], skill: "clean" },
      helper: { skill: "clean" },
      "deploy-kit": { dependencies: ["helper"], skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": {}, "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert -- app's own cascade row is the only row; helper is
    // materialized once, and deploy-kit is left untouched.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● app v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const helper = await recordFor(project, "mp", "helper");
    assert.equal(helper?.provenance, "dependency");
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL2-01: a read that fails after the missing-dependency install keeps its row, reports state.json, and the scope is still judged", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-reread-fallback");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    // The first read of the project scope that records secrets-vault is the
    // one after the missing-dependency install; it fails once.
    let failed = false;
    let readsAfterFailure = 0;
    const applyWithFailingReread = createApplyReconcile({
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        const state = await loadState(extensionRoot);
        if (extensionRoot !== project.extensionRoot) {
          return state;
        }

        if (failed) {
          readsAfterFailure += 1;
          return state;
        }

        if (state.marketplaces["mp"]?.plugins["secrets-vault"] !== undefined) {
          failed = true;
          throw new Error("read after the install failed");
        }

        return state;
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithFailingReread({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });

    // assert -- the install row still renders, plus a synthesized state.json
    // row for the failed re-read; the judgement reads the scope once more and
    // judges it as the install left it, so deploy-kit, whose dependency is now
    // recorded, stays up unmarked.
    assert.equal(failed, true);
    assert.equal(readsAfterFailure, 1);
    assert.equal(notifications.length, 1);
    const message = notifications[0]?.message ?? "";
    assert.ok(message.includes("secrets-vault v1.0.0 (installed) {dependency installed}"));
    assert.ok(message.includes("state.json (failed)"));
    const secretsVault = await recordFor(project, "mp", "secrets-vault");
    assert.equal(secretsVault?.provenance, "dependency");
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL2-01 / GHB-03: a dependency installed before a later install throws keeps its dependent enabled", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const { cwd, project } = await createHermeticScopes(t, "dependency-install-then-throw");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["alpha-vault"], skill: "clean" },
      "audit-kit": { dependencies: ["zeta-vault"], skill: "clean" },
      "alpha-vault": { skill: "clean" },
    });
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      plugins: unknown[];
    };
    manifest.plugins.push({
      name: "zeta-vault",
      version: "1.0.0",
      source: { source: "github", repo: "acme/zeta-vault", sha: "a".repeat(40) },
    });
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "audit-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "audit-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "audit-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    const pass = applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    await assert.rejects(pass, InvalidGitHubBaseUrlError);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● alpha-vault v1.0.0 (installed) {dependency installed}\n" +
          "  ◍ audit-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "zeta-vault@mp" or uninstall "audit-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    const records = await Promise.all(
      ["alpha-vault", "deploy-kit", "audit-kit"].map((plugin) => recordFor(project, "mp", plugin)),
    );
    assert.deepStrictEqual(
      records.map((record) => [record?.enabled, record?.dependencyDisabled]),
      [
        [true, undefined],
        [true, undefined],
        [false, true],
      ],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-07: a read pass that fails after a config install keeps the round-1 toggles and reports state.json", async (t) => {
    // arrange -- the config installs secrets-vault, which deploy-kit declares.
    const { cwd, project } = await createHermeticScopes(t, "config-install-reread-fallback");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    // The first read of the project scope that records secrets-vault is the
    // D-09-07 re-read after the config install; it fails once.
    let failed = false;
    const applyWithFailingReread = createApplyReconcile({
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        const state = await loadState(extensionRoot);
        const recorded = state.marketplaces["mp"]?.plugins["secrets-vault"] !== undefined;
        if (extensionRoot === project.extensionRoot && recorded && !failed) {
          failed = true;
          throw new Error("read after the install failed");
        }

        return state;
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithFailingReread({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });

    // assert -- the install row still renders, plus a synthesized state.json
    // row for the failed re-read; round-1's toggles held nothing down, since
    // they count the planned install as landed (D-PL2-02).
    assert.equal(failed, true);
    assert.equal(notifications.length, 1);
    const message = notifications[0]?.message ?? "";
    assert.ok(message.includes("secrets-vault v1.0.0 (installed)\n"));
    assert.ok(message.includes("state.json (failed)"));
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-11: a missing dependency an earlier entry's cascade installed answers as present and reports no second row", async (t) => {
    // arrange -- deploy-kit declares alpha and beta, and alpha declares beta,
    // so alpha's cascade installs beta before beta's own entry runs.
    const { cwd, project } = await createHermeticScopes(t, "dependency-installed-by-earlier-entry");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["alpha", "beta"], skill: "clean" },
      alpha: { dependencies: ["beta"], skill: "clean" },
      beta: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● beta v1.0.0 (installed) {dependency installed}\n" +
          "  ● alpha v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "deploy-kit"))?.enabled, true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL2-14: a dependency the user disabled and the config enables comes up after the install it waits on, and its dependent stays up", async (t) => {
    // arrange -- app declares core; core, disabled by the user and enabled by
    // the config, declares vault, which mp offers and the scope lacks. The
    // rows match the pending D-21 row for the same shape: vault, then core.
    const { cwd, project } = await createHermeticScopes(t, "user-disabled-dependency-waits");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      app: { dependencies: ["core"], skill: "clean" },
      core: { dependencies: ["vault"], skill: "clean" },
      vault: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": { enabled: true }, "core@mp": { enabled: true } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            app: pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "app"),
            }),
            core: pluginRecord({
              enabled: false,
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "core"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● vault v1.0.0 (installed) {dependency installed}\n" +
          "  ● core v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const records = await Promise.all(
      ["app", "core", "vault"].map((plugin) => recordFor(project, "mp", plugin)),
    );
    assert.deepStrictEqual(
      records.map((record) => [record?.enabled, Object.hasOwn(record ?? {}, "dependencyDisabled")]),
      [
        [true, false],
        [true, false],
        [true, false],
      ],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-07: source-mismatch rows come from the round-1 plan", async (t) => {
    // arrange -- a dangling reference beside the reload's install row.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-dangling");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "ghost@nowhere": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.equal(notifications.length, 1);
    const message = notifications[0]?.message ?? "";
    assert.ok(message.includes("secrets-vault v1.0.0 (installed) {dependency installed}"));
    assert.ok(message.includes("nowhere [project] (failed) {dangling reference}"));
    assert.ok(message.includes("⊘ ghost (failed) {dangling reference}"));
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  for (const scenario of [
    { name: "second foreign policy", secondMarketplace: "gamma", secondAllows: true },
    { name: "later same-marketplace source", secondMarketplace: "beta", secondAllows: false },
    { name: "neither original policy", secondMarketplace: "gamma", secondAllows: false },
  ] as const) {
    test(`XMKT-01 apply evaluates ${scenario.name}`, async (t) => {
      // arrange
      const { cwd, project, user } = await createHermeticScopes(t, "dependency-original-sources");
      const alpha = await writeMarketplaceSource(cwd, "alpha-src", "alpha", {
        a: { dependencies: ["b@beta"], skill: "clean" },
      });
      const beta = await writeMarketplaceSource(cwd, "beta-src", "beta", {
        b: { skill: "clean" },
        ...(scenario.secondMarketplace === "beta" && {
          c: { dependencies: ["b@beta"] as const, skill: "clean" as const },
        }),
      });
      const gamma =
        scenario.secondMarketplace === "gamma"
          ? await writeMarketplaceSource(
              cwd,
              "gamma-src",
              "gamma",
              { c: { dependencies: ["b@beta"], skill: "clean" } },
              scenario.secondAllows ? ["beta"] : [],
            )
          : undefined;
      await writeUnder(
        project.baseConfigJsonPath,
        configBytes({
          marketplaces: {
            alpha: { source: alpha.marketplaceRoot },
            beta: { source: beta.marketplaceRoot },
            ...(gamma !== undefined && { gamma: { source: gamma.marketplaceRoot } }),
          },
          plugins: {
            "a@alpha": {},
            [`c@${scenario.secondMarketplace}`]: {},
          },
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        marketplaces: {
          alpha: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "alpha",
            rawSource: alpha.marketplaceRoot,
            manifestPath: alpha.manifestPath,
            marketplaceRoot: alpha.marketplaceRoot,
            plugins: {
              a: pluginRecord({
                supported: ["skills"],
                pluginRoot: path.join(alpha.marketplaceRoot, "plugins", "a"),
              }),
            },
          }),
          beta: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "beta",
            rawSource: beta.marketplaceRoot,
            manifestPath: beta.manifestPath,
            marketplaceRoot: beta.marketplaceRoot,
            ...(scenario.secondMarketplace === "beta" && {
              plugins: {
                c: pluginRecord({
                  supported: ["skills"],
                  pluginRoot: path.join(beta.marketplaceRoot, "plugins", "c"),
                }),
              },
            }),
          }),
          ...(gamma !== undefined && {
            gamma: marketplaceRecord({
              cwd,
              scope: "project",
              marketplace: "gamma",
              rawSource: gamma.marketplaceRoot,
              manifestPath: gamma.manifestPath,
              marketplaceRoot: gamma.marketplaceRoot,
              plugins: {
                c: pluginRecord({
                  supported: ["skills"],
                  pluginRoot: path.join(gamma.marketplaceRoot, "plugins", "c"),
                }),
              },
            }),
          }),
        },
      });
      const planned = await replanFromDisk(project);
      assert.deepStrictEqual(planned.pluginsToDependencyInstall, [
        {
          scope: "project",
          plugin: "b",
          marketplace: "beta",
          ranges: [],
          requiredBy: "a@alpha",
          declarers: ["a@alpha", `c@${scenario.secondMarketplace}`],
        },
      ]);
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({
        ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        gitOps,
      });

      // assert
      const b = await recordFor(project, "beta", "b");
      if (scenario.secondMarketplace === "gamma" && !scenario.secondAllows) {
        assert.equal(b, undefined);
        assert.match(notifications[0]?.message ?? "", /b \(failed\) \{cross-marketplace\}/);
        assert.match(
          notifications[0]?.message ?? "",
          /declared by "a@alpha".*root marketplace "alpha".*Install "b@beta" manually first.*allowCrossMarketplaceDependenciesOn/,
        );
        assert.equal((await recordFor(project, "alpha", "a"))?.enabled, false);
      } else {
        assert.equal(b?.provenance, "dependency");
        assert.deepStrictEqual(notifications, [
          {
            message:
              "● beta [project]\n" +
              "  ● b v1.0.0 (installed) {dependency installed}\n" +
              "\n" +
              "Reconcile: 1 success\n" +
              "\n" +
              "/reload to pick up changes",
          },
        ]);
      }

      assert.equal(await pathExists(user.stateJsonPath), false);
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("XMKT-01 apply installs a user-sourced missing dependency into project scope", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "dependency-user-source");
    const alpha = await writeMarketplaceSource(
      cwd,
      "alpha-src",
      "alpha",
      { a: { dependencies: ["b@beta"], skill: "clean" } },
      ["beta"],
    );
    const beta = await writeMarketplaceSource(cwd, "beta-user-src", "beta", {
      b: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { alpha: { source: alpha.marketplaceRoot } },
        plugins: { "a@alpha": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        alpha: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "alpha",
          rawSource: alpha.marketplaceRoot,
          manifestPath: alpha.manifestPath,
          marketplaceRoot: alpha.marketplaceRoot,
          plugins: {
            a: pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(alpha.marketplaceRoot, "plugins", "a"),
            }),
          },
        }),
      },
    });
    await seedState(user, {
      schemaVersion: 3,
      marketplaces: {
        beta: marketplaceRecord({
          cwd,
          scope: "user",
          marketplace: "beta",
          rawSource: beta.marketplaceRoot,
          manifestPath: beta.manifestPath,
          marketplaceRoot: beta.marketplaceRoot,
        }),
      },
    });
    const userBefore = await readFile(user.stateJsonPath);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.equal((await recordFor(project, "beta", "b"))?.provenance, "dependency");
    assert.deepStrictEqual(await readFile(user.stateJsonPath), userBefore);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● beta [project]\n" +
          "  ● b v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-09: a cross-marketplace member renders under its own marketplace block", async (t) => {
    // arrange -- deploy-kit@mp declares { name: "shared-lib", marketplace:
    // "tools" }, with tools added and declaring shared-lib.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-cross-marketplace");
    const mp = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { skill: "clean" },
    });
    const tools = await writeMarketplaceSource(cwd, "tools-src", "tools", {
      "shared-lib": { skill: "clean" },
    });
    await writeUnder(
      mp.manifestPath,
      JSON.stringify({
        name: "mp",
        allowCrossMarketplaceDependenciesOn: ["tools"],
        plugins: [
          {
            name: "deploy-kit",
            version: "1.0.0",
            source: "./plugins/deploy-kit",
            dependencies: [{ name: "shared-lib", marketplace: "tools", version: "*" }],
          },
        ],
      }),
    );
    await writeUnder(
      path.join(mp.marketplaceRoot, "plugins", "deploy-kit", ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "deploy-kit",
        version: "1.0.0",
        dependencies: [{ name: "shared-lib", marketplace: "tools", version: "*" }],
      }),
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: {
          mp: { source: mp.marketplaceRoot },
          tools: { source: tools.marketplaceRoot },
        },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: mp.marketplaceRoot,
          manifestPath: mp.manifestPath,
          marketplaceRoot: mp.marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(mp.marketplaceRoot, "plugins", "deploy-kit"),
            }),
          },
        }),
        tools: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "tools",
          rawSource: tools.marketplaceRoot,
          manifestPath: tools.manifestPath,
          marketplaceRoot: tools.marketplaceRoot,
        }),
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● tools [project]\n" +
          "  ● shared-lib v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-11: a member the cascade found already installed renders nothing", async (t) => {
    // arrange -- secrets-vault declares common, which is already recorded
    // and enabled.
    const { cwd, project } = await createHermeticScopes(
      t,
      "dependency-reload-already-installed-member",
    );
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { dependencies: ["common"], skill: "clean" },
      common: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "common@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            common: pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "common"),
            }),
          },
        }),
      },
    });
    const before = await recordFor(project, "mp", "common");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const after = await recordFor(project, "mp", "common");
    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("NFR-5: a reload with nothing missing installs nothing and reads the scope once", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-nothing-missing");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            "deploy-kit": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "deploy-kit"),
            }),
            "secrets-vault": pluginRecord({
              supported: ["skills"],
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const settledBytes = await readFile(project.stateJsonPath, "utf8");
    const settledModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;

    let startupCalls = 0;
    const withCounter = (onCall: () => void) =>
      createApplyReconcile({
        async loadState(extensionRoot: string): Promise<ExtensionState> {
          if (extensionRoot === project.extensionRoot) {
            onCall();
          }

          return loadState(extensionRoot);
        },
      });

    const startup = createNotificationBoundary(1);
    await withCounter(() => {
      startupCalls += 1;
    })({
      ctx: startup.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      gitOps: createOfflineGitOps().gitOps,
    });

    let reloadCalls = 0;
    const reload = createNotificationBoundary(1);
    await withCounter(() => {
      reloadCalls += 1;
    })({
      ctx: reload.ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      gitOps: createOfflineGitOps().gitOps,
    });

    // assert
    assert.deepStrictEqual(startup.notifications, [APPLY_EMPTY_NOTICE]);
    assert.deepStrictEqual(reload.notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(reloadCalls, startupCalls);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, settledModifiedAt);
    startup.verifyBoundary();
    reload.verifyBoundary();
  });

  test("AFILE-04: a reload install over a commented mcp-adapter.json shows the comments-removed notice after the cascade", async (t) => {
    // arrange
    const { cwd } = await seedCommentedAdapterScope(t, "afile-install", {
      trees: { hello: { mcpServer: true } },
      declared: { "hello@mp": {} },
      recorded: {},
      owners: [],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("AVAR-04: the reconcile cascade reports the unset variable and the withheld credential", async (t) => {
    // arrange
    // Plugin `hello` declares a stdio server that reads the unset
    // `PI_CM_AVAR_SITE` and a remote server that sends the set
    // `ANTHROPIC_API_KEY`, which Claude Code never sends to a remote server.
    const savedSite = process.env.PI_CM_AVAR_SITE;
    const savedCredential = process.env.ANTHROPIC_API_KEY;
    t.after(() => {
      for (const [name, saved] of [
        ["PI_CM_AVAR_SITE", savedSite],
        ["ANTHROPIC_API_KEY", savedCredential],
      ] as const) {
        if (saved === undefined) {
          Reflect.deleteProperty(process.env, name);
        } else {
          process.env[name] = saved;
        }
      }
    });
    delete process.env.PI_CM_AVAR_SITE;
    process.env.ANTHROPIC_API_KEY = "avar-sentinel-04-09";
    const { cwd } = await seedCommentedAdapterScope(t, "avar-install", {
      trees: { hello: {} },
      declared: { "hello@mp": {} },
      recorded: {},
      owners: [],
    });
    await writeUnder(
      path.join(cwd, "mp-src", "plugins", "hello", ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          local: { command: "node", args: ["--site", "${PI_CM_AVAR_SITE}"] },
          api: {
            type: "http",
            url: "https://mcp.example.test/mcp",
            headers: { Authorization: "Bearer ${ANTHROPIC_API_KEY}" },
          },
        },
      }),
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(4);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
      {
        message:
          "MCP server variables not set.\n\n" +
          'Server "plugin_hello_local_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_AVAR_SITE.',
        severity: "warning",
      },
      {
        message:
          "MCP server credentials withheld.\n\n" +
          'Server "plugin_hello_api_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(
      notifications.filter(({ message }) => message.includes("avar-sentinel-04-09")),
      [],
    );
    verifyBoundary();
  });

  test("AFILE-04 / D-08: a reload with nothing to apply reports so and leaves the commented mcp-adapter.json unchanged", async (t) => {
    // arrange
    const { cwd, project, adapter } = await seedCommentedAdapterScope(t, "afile-silent", {
      trees: { hello: { mcpServer: true } },
      declared: { "hello@mp": {} },
      recorded: { hello: { mcpServers: ["hello-echo"] } },
      owners: ["hello"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.mcpAdapterJsonPath, "utf8"), adapter);
    verifyBoundary();
  });

  test("AFILE-04: a reload uninstall that rewrites a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd, project } = await seedCommentedAdapterScope(t, "afile-uninstall", {
      trees: { hello: { mcpServer: true } },
      declared: {},
      recorded: { hello: { mcpServers: ["hello-echo"] } },
      owners: ["hello"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    assert.equal(await readFile(project.mcpAdapterJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    verifyBoundary();
  });

  test("AFILE-04: a reload enable that re-materializes over a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd } = await seedCommentedAdapterScope(t, "afile-enable", {
      trees: { hello: { mcpServer: true } },
      declared: { "hello@mp": {} },
      recorded: { hello: { enabled: false } },
      owners: [],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("D-PL1-07 / D-PL1-09: an enable whose skills collide shows the skip after the install block and before the MCP notice", async (t) => {
    // arrange -- `duo` installs with one post-install warning; `hello` is
    // enabled, collides on a skill, and rewrites the commented adapter file.
    const { cwd } = await seedCommentedAdapterScope(t, "enable-staging-warning", {
      trees: { duo: { agents: ["with-mcp-servers"] }, hello: { skill: "clean", mcpServer: true } },
      declared: { "duo@mp": {}, "hello@mp": {} },
      recorded: { hello: { enabled: false } },
      owners: [],
    });
    await collidingSkill(path.join(cwd, "mp-src"), "hello");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(4);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● duo v1.0.0 (installed) {requires pi-subagents}\n" +
          "  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          "1 post-install warning surfaced from reconcile installs.\n" +
          "\n" +
          '[bot0] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["duo:bot0"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
        severity: "warning",
      },
      {
        message:
          'Plugin "hello" [project] enabled; 1 declared component has a note.\n' +
          "\n" +
          'skill source "tool" in "skills" elides to generated name "hello-tool", already produced by skill source "hello-tool"; ignoring duplicate.',
        severity: "warning",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("AFILE-04: a reload disable that unstages from a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd, project } = await seedCommentedAdapterScope(t, "afile-disable", {
      trees: { hello: { mcpServer: true } },
      declared: { "hello@mp": { enabled: false } },
      recorded: { hello: { mcpServers: ["hello-echo"] } },
      owners: ["hello"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ◍ hello v1.0.0 (disabled)\n\nReconcile: 1 success\n\n/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    assert.equal(await readFile(project.mcpAdapterJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    verifyBoundary();
  });

  test("AFILE-04: a load-time dependency disable that unstages from a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd, project } = await seedCommentedAdapterScope(t, "afile-dependency-disable", {
      trees: { "deploy-kit": { dependencies: ["secrets-vault"], mcpServer: true } },
      declared: { "deploy-kit@mp": {} },
      recorded: { "deploy-kit": { mcpServers: ["deploy-kit-echo"] } },
      owners: ["deploy-kit"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ secrets-vault (failed) {not in manifest}\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    assert.equal(await readFile(project.mcpAdapterJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    verifyBoundary();
  });

  test("AFILE-04: a reload marketplace removal that unstages from a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd, project } = await seedCommentedAdapterScope(t, "afile-marketplace-remove", {
      trees: { hello: { mcpServer: true } },
      declared: undefined,
      recorded: { hello: { mcpServers: ["hello-echo"] } },
      owners: ["hello"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] (removed)\n" +
          "  ○ hello (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    assert.equal(await readFile(project.mcpAdapterJsonPath, "utf8"), '{\n  "mcpServers": {}\n}\n');
    verifyBoundary();
  });

  test("AFILE-04: a reload marketplace removal whose state save fails reports the failed row and still shows the notice", async (t) => {
    // arrange
    const { cwd, project, denyWrites } = await seedCommentedAdapterScope(
      t,
      "afile-marketplace-remove-save",
      {
        trees: { hello: { mcpServer: true } },
        declared: undefined,
        recorded: { hello: { mcpServers: ["hello-echo"] } },
        owners: ["hello"],
      },
    );
    // The state file reads through a link into a read-only directory, so every
    // load and the scope lock succeed and the removal's own save is refused.
    const lockedDirectory = path.join(cwd, "locked-state");
    const lockedState = path.join(lockedDirectory, "state.json");
    await writeUnder(lockedState, await readFile(project.stateJsonPath, "utf8"));
    await rm(project.stateJsonPath);
    await symlink(lockedState, project.stateJsonPath);
    await denyWrites(lockedDirectory);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("AFILE-04: a reload dependency install over a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd } = await seedCommentedAdapterScope(t, "afile-dependency-install", {
      trees: {
        "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
        "secrets-vault": { mcpServer: true },
      },
      declared: { "deploy-kit@mp": {} },
      recorded: { "deploy-kit": { supported: ["skills"] } },
      owners: [],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed, requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("AFILE-04: a reload whose uninstall and install both rewrite one commented mcp-adapter.json shows one notice", async (t) => {
    // arrange
    const { cwd } = await seedCommentedAdapterScope(t, "afile-base-config", {
      trees: { alfa: { mcpServer: true }, bravo: { mcpServer: true } },
      declared: { "bravo@mp": {} },
      recorded: { alfa: { mcpServers: ["alfa-echo"] } },
      owners: ["alfa"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ alfa v1.0.0 (uninstalled)\n" +
          "  ● bravo v1.0.0 (installed) {requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });
  test("AMIG-01: the MCP move runs once per scope after the read pass and before the plan is applied", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mcp-move-position");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      gone: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            gone: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "gone") }),
          },
        }),
      },
    });
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const uninstallPlugin = t.mock.fn(createUninstallOperation(hooksRouting, completionCache));
    const calls: unknown[] = [];
    const migrateMcpEntries: McpMigrationStep = async (input) => {
      const state = await loadState(locationsFor(input.scope, cwd).extensionRoot);
      calls.push({
        scope: input.scope,
        plannedUninstalls: input.plan?.pluginsToUninstall.map((planned) => planned.plugin),
        recorded: Object.keys(state.marketplaces["mp"]?.plugins ?? {}),
        uninstallsBefore: uninstallPlugin.mock.callCount(),
      });
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcileWithRouting({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      gitOps,
      hooksRouting,
      completionCache,
      uninstallPlugin,
      migrateMcpEntries,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ gone v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(calls, [
      {
        scope: "project",
        plannedUninstalls: ["gone"],
        recorded: ["gone"],
        uninstallsBefore: 0,
      },
      {
        scope: "user",
        plannedUninstalls: undefined,
        recorded: [],
        uninstallsBefore: 1,
      },
    ]);
    assert.deepStrictEqual(
      uninstallPlugin.mock.calls.map(
        (call) => `${call.arguments[0].plugin}@${call.arguments[0].marketplace}`,
      ),
      ["gone@mp"],
    );
    verifyBoundary();
  });

  test("AMIG-01: the MCP move runs with no plan when the scope's configuration is invalid", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mcp-move-invalid-config");
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(project.baseConfigJsonPath, "{");
    const calls: unknown[] = [];
    const migrateMcpEntries: McpMigrationStep = async (input) => {
      calls.push({ scope: input.scope, plan: input.plan });
      await Promise.resolve();
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      migrateMcpEntries,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ claude-plugins.json [project] (failed) {invalid manifest}\n" +
          "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
          "    cause: JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(calls, [{ scope: "project", plan: undefined }]);
    verifyBoundary();
  });

  test("AMIG-01: the MCP move does not run for a scope whose read pass threw", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mcp-move-read-pass-threw");
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(project.stateJsonPath, "{ not json");
    const calls: unknown[] = [];
    const migrateMcpEntries: McpMigrationStep = async (input) => {
      calls.push(input.scope);
      await Promise.resolve();
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      migrateMcpEntries,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ state.json [project] (failed) {unparseable}\n" +
          "  ⊘ state.json (failed) {unparseable}\n" +
          "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(calls, []);
    verifyBoundary();
  });

  test("NFR-2: a throwing MCP move becomes one warning notice before the cascade, which still follows", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mcp-move-throws");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      gone: { skill: "clean" },
    });
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            gone: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "gone") }),
          },
        }),
      },
    });
    const migrateMcpEntries: McpMigrationStep = async () => {
      await Promise.resolve();
      throw new Error(`cannot read ${path.join(cwd, ".pi", "mcp.json")}`);
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      migrateMcpEntries,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Plugin MCP servers in mcp.json need attention.\n" +
          "\n" +
          "Left in mcp.json:\n" +
          "  The project-scope move stopped: cannot read mcp.json. The next /reload tries again.",
        severity: "warning",
      },
      {
        message:
          "● mp [project]\n" +
          "  ○ gone v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      [],
    );
    verifyBoundary();
  });

  test("AMIG-03 / D-08: the migration notice precedes the apply-empty advisory when reconcile has no outcome", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "mcp-move-alone");
    await seedState(project, {
      schemaVersion: 3,
      marketplaces: {},
    });
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    const migrateMcpEntries: McpMigrationStep = async (input) => {
      input.rows.push({
        kind: "moved",
        scope: input.scope,
        plugin: "hello",
        marketplace: "mp",
        from: "srv",
        to: "plugin_hello_srv_",
      });
      await Promise.resolve();
    };

    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      migrateMcpEntries,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.\n" +
          "\n" +
          "Moved to mcp-adapter.json:\n" +
          "  srv -> plugin_hello_srv_ (hello) [project]\n" +
          "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.\n" +
          "/reload to pick up changes",
        severity: "info",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    verifyBoundary();
  });
});

/**
 * APL-02: one project scope over the path marketplace `mp`, declaring and
 * recording every plugin of `trees` at 1.0.0 with its supported kinds, so no
 * move is a growth. `offered` then moves a plugin's catalog version, in both
 * its own manifest and its marketplace entry; `dependencies` adds versioned
 * declarations the same way.
 */
async function seedConvergenceScope(
  t: TestContext,
  label: string,
  seed: {
    readonly trees: Readonly<Record<string, PluginTree>>;
    readonly supported: Readonly<Record<string, readonly string[]>>;
    readonly offered?: Readonly<Record<string, string>>;
    readonly dependencies?: Readonly<
      Record<string, readonly { readonly name: string; readonly version: string }[]>
    >;
    /** Per-plugin record fields beyond the supported set; a disabled record is disabled in config too. */
    readonly records?: Readonly<Record<string, Omit<RecordSeed, "pluginRoot" | "supported">>>;
  },
): Promise<{
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly marketplaceRoot: string;
}> {
  const { cwd, project } = await createHermeticScopes(t, label);
  const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
    cwd,
    "mp-src",
    "mp",
    seed.trees,
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    readonly name: string;
    readonly plugins: readonly Record<string, unknown>[];
  };
  const plugins = Object.keys(seed.trees);
  for (const plugin of plugins) {
    const version = seed.offered?.[plugin] ?? "1.0.0";
    const dependencies = seed.dependencies?.[plugin];
    await writeFile(
      path.join(marketplaceRoot, "plugins", plugin, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: plugin,
        version,
        ...(dependencies !== undefined && { dependencies }),
      }),
    );
  }

  await writeFile(
    manifestPath,
    JSON.stringify({
      ...manifest,
      plugins: manifest.plugins.map((entry) => {
        const name = entry["name"] as string;
        const dependencies = seed.dependencies?.[name];
        return {
          ...entry,
          version: seed.offered?.[name] ?? "1.0.0",
          ...(dependencies !== undefined && { dependencies }),
        };
      }),
    }),
  );
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: Object.fromEntries(
        plugins.map((plugin) => [
          `${plugin}@mp`,
          seed.records?.[plugin]?.enabled === false ? { enabled: false } : {},
        ]),
      ),
    }),
  );
  await seedState(project, {
    schemaVersion: 3,
    marketplaces: {
      mp: marketplaceRecord({
        cwd,
        scope: "project",
        marketplace: "mp",
        rawSource: marketplaceRoot,
        manifestPath,
        marketplaceRoot,
        plugins: Object.fromEntries(
          plugins.map((plugin) => [
            plugin,
            pluginRecord({
              ...seed.records?.[plugin],
              pluginRoot: path.join(marketplaceRoot, "plugins", plugin),
              supported: seed.supported[plugin] ?? [],
            }),
          ]),
        ),
      }),
    },
  });
  return { cwd, project, marketplaceRoot };
}

/**
 * APPLY1-01: `widget` 1.1.0 needs zcore ^2.0.0 and ships with `zcore` 2.0.0;
 * both are recorded at 1.0.0. `widget`'s seeded record fields go in `widget`.
 */
function coShippedSeed(widget: Omit<RecordSeed, "pluginRoot" | "supported"> = {}) {
  return {
    trees: { widget: { skill: "clean" }, zcore: { skill: "clean" } },
    supported: { widget: ["skills"], zcore: ["skills"] },
    offered: { widget: "1.1.0", zcore: "2.0.0" },
    dependencies: { widget: [{ name: "zcore", version: "^2.0.0" }] },
    records: { widget },
  } as const;
}

/**
 * Records `widget` at a per-commit copy under the plugin clones whose manifest
 * links to a file in the project directory, outside its plugin directory.
 */
async function pinWidgetToEscapingCopy(project: ScopedLocations, cwd: string): Promise<void> {
  const copy = path.join(project.pluginClonesDir, "widget-copy");
  const outside = path.join(cwd, "outside-plugin.json");
  await writeUnder(outside, JSON.stringify({ name: "widget", version: "1.0.0" }));
  await mkdir(path.join(copy, ".claude-plugin"), { recursive: true });
  await symlink(outside, path.join(copy, ".claude-plugin", "plugin.json"));
  const seeded = await loadState(project.extensionRoot);
  const widget = seeded.marketplaces.mp?.plugins.widget;
  assert.ok(widget !== undefined);
  widget.resolvedSource = copy;
  widget.resolvedSha = "a".repeat(40);
  await saveState(project.extensionRoot, seeded);
}

/** D-PL2-25 / REC-05: the one row an apply reports for `widget`'s refused copy. */
const REFUSED_WIDGET_COPY_NOTIFICATION = {
  message:
    "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ widget (failed) {unreadable manifest}\n    cause: cannot read the dependencies of widget@mp: its own manifest is present but cannot be read\n\nReconcile: 1 warning",
  severity: "warning",
};

/** Leaves a file nobody may read in `plugin`'s skill, so its move fails to copy it. */
async function unreadableSkill(marketplaceRoot: string, plugin: string): Promise<void> {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("an unreadable file cannot stop root; run this suite as a non-root user");
  }

  await writeFile(
    path.join(marketplaceRoot, "plugins", plugin, "skills", "tool", "notes.md"),
    "x",
    {
      mode: 0o000,
    },
  );
}

/**
 * D-PL1-07: gives `plugin` a second skill whose generated name collides with
 * the `tool` skill's, so its staging skips one declared component.
 */
async function collidingSkill(marketplaceRoot: string, plugin: string): Promise<void> {
  await writeUnder(
    path.join(marketplaceRoot, "plugins", plugin, "skills", `${plugin}-tool`, "SKILL.md"),
    `---\nname: ${plugin}-tool\n---\n\nbody\n`,
  );
}

/** Declares each plugin of `mp` enabled in the project's base config. */
async function declareEnabled(
  project: ScopedLocations,
  cwd: string,
  plugins: readonly string[],
): Promise<void> {
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes({
      marketplaces: { mp: { source: path.join(cwd, "mp-src") } },
      plugins: Object.fromEntries(plugins.map((plugin) => [`${plugin}@mp`, {}])),
    }),
  );
}

/** Drops `plugins` from the project scope's record, as if never installed. */
async function withoutRecords(project: ScopedLocations, plugins: readonly string[]): Promise<void> {
  const state = await loadState(project.extensionRoot);
  const mp = state.marketplaces.mp;
  assert.ok(mp !== undefined);
  mp.plugins = Object.fromEntries(
    Object.entries(mp.plugins).filter(([plugin]) => !plugins.includes(plugin)),
  );
  await saveState(project.extensionRoot, state);
}

/**
 * MISSORDER-01: `widget` 1.1.0 needs `newdep`, which needs ycore ^2.0.0, and
 * ships with `ycore` 2.0.0; `widget` and `ycore` are recorded at 1.0.0 and
 * `newdep` is offered but neither recorded nor declared.
 */
async function seedMissingAfterMoves(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly project: ScopedLocations }> {
  const { cwd, project } = await seedConvergenceScope(t, label, {
    trees: { widget: { skill: "clean" }, ycore: { skill: "clean" }, newdep: { skill: "clean" } },
    supported: { widget: ["skills"], ycore: ["skills"], newdep: ["skills"] },
    offered: { widget: "1.1.0", ycore: "2.0.0" },
    dependencies: {
      widget: [{ name: "newdep", version: "*" }],
      newdep: [{ name: "ycore", version: "^2.0.0" }],
    },
  });
  await withoutRecords(project, ["newdep"]);
  await declareEnabled(project, cwd, ["widget", "ycore"]);
  return { cwd, project };
}

/**
 * WR-06: `bapp` 2.0.0 needs alib ^2.0.0 and `alib` 2.0.0 needs `cdep`; both
 * are recorded at 1.0.0, `alib` held down by the LOAD-02 marker, and `cdep`
 * is neither recorded nor declared. `offerMissing` puts `cdep` in the
 * marketplace; `dependentHeld` holds `bapp` down too.
 */
async function seedWaitingDependencyMoves(
  t: TestContext,
  label: string,
  options: { readonly offerMissing: boolean; readonly dependentHeld?: boolean },
): Promise<{ readonly cwd: string; readonly project: ScopedLocations }> {
  const held = { enabled: false, dependencyDisabled: true } as const;
  const { cwd, project } = await seedConvergenceScope(t, label, {
    trees: {
      bapp: { skill: "clean" },
      alib: { skill: "clean" },
      ...(options.offerMissing && { cdep: { skill: "clean" } }),
    },
    supported: { bapp: ["skills"], alib: ["skills"], cdep: ["skills"] },
    offered: { bapp: "2.0.0", alib: "2.0.0" },
    dependencies: {
      bapp: [{ name: "alib", version: "^2.0.0" }],
      alib: [{ name: "cdep", version: "*" }],
    },
    records: { alib: held, ...(options.dependentHeld === true && { bapp: held }) },
  });
  await withoutRecords(project, ["cdep"]);
  await declareEnabled(project, cwd, ["bapp", "alib"]);
  return { cwd, project };
}

/** The version, enabled flag and LOAD-02 marker of each of `plugins` in the project scope. */
async function recordStates(
  project: ScopedLocations,
  plugins: readonly string[],
): Promise<(readonly [string | undefined, boolean | undefined, boolean | undefined])[]> {
  const records = await Promise.all(plugins.map((plugin) => recordFor(project, "mp", plugin)));
  return records.map((record) => [record?.version, record?.enabled, record?.dependencyDisabled]);
}

describe("applyReconcile catalog convergence", () => {
  test("APPLY1-01: a plugin and the newer dependency it needs move in one apply, the dependency first", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "cascade-co-shipped", coShippedSeed());
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● zcore v1.0.0 → v2.0.0 (updated)\n" +
          "  ● widget v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "widget"))?.enabled, true);
    verifyBoundary();
  });

  test("D-PL1-07 / D-PL1-20: a catalog move whose skills collide shows the skip after the cascade under its updated header", async (t) => {
    // arrange
    const { cwd, marketplaceRoot } = await seedConvergenceScope(t, "converged-staging-warning", {
      trees: { widget: { skill: "clean" } },
      supported: { widget: ["skills"] },
      offered: { widget: "1.1.0" },
    });
    await collidingSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● widget v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          'Plugin "widget" [project] updated; 1 declared component has a note.\n' +
          "\n" +
          'skill source "widget-tool" in "skills" elides to generated name "widget-tool", already produced by skill source "tool"; ignoring duplicate.',
        severity: "warning",
      },
    ]);
    verifyBoundary();
  });

  test("D-PL1-25: a catalog move shows the moved plugin's skip and its dropped agent field under one updated header", async (t) => {
    // arrange
    const { cwd, marketplaceRoot } = await seedConvergenceScope(t, "converged-both-halves", {
      trees: { widget: { skill: "clean", agents: ["with-mcp-servers"] } },
      supported: { widget: ["skills", "agents"] },
      offered: { widget: "1.1.0" },
    });
    await collidingSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● widget v1.0.0 → v1.1.0 (updated) {requires pi-subagents}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      {
        message:
          'Plugin "widget" [project] updated; 1 declared component has a note; 1 staging warning.\n' +
          "\n" +
          'skill source "widget-tool" in "skills" elides to generated name "widget-tool", already produced by skill source "tool"; ignoring duplicate.\n' +
          '[bot0] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). To grant this agent MCP tools, set subagents.agentOverrides["widget:bot0"].tools (e.g. read,bash,mcp:<server>) in Pi settings.',
        severity: "warning",
      },
    ]);
    verifyBoundary();
  });

  test("D-PL2-01: a missing dependency that needs a version a move lands is installed after the moves, in one apply", async (t) => {
    // arrange
    const { cwd, project } = await seedMissingAfterMoves(t, "missing-after-moves");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● widget v1.0.0 → v1.1.0 (updated)\n" +
          "  ● ycore v1.0.0 → v2.0.0 (updated)\n" +
          "  ● newdep v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 3 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const records = await Promise.all(
      ["widget", "ycore", "newdep"].map((plugin) => recordFor(project, "mp", plugin)),
    );
    assert.deepStrictEqual(
      records.map((record) => [record?.version, record?.enabled]),
      [
        ["1.1.0", true],
        ["2.0.0", true],
        ["1.0.0", true],
      ],
    );
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL2-01: a read that fails after the moves installs no missing dependency from the plan made before them", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "moves-then-read-fails", {
      trees: { widget: { skill: "clean" }, ycore: { skill: "clean" }, newdep: { skill: "clean" } },
      supported: { widget: ["skills"], ycore: ["skills"], newdep: ["skills"] },
      offered: { ycore: "2.0.0" },
      dependencies: { widget: [{ name: "newdep", version: "*" }] },
    });
    await withoutRecords(project, ["newdep"]);
    await declareEnabled(project, cwd, ["widget", "ycore"]);
    // The first read of the project scope after ycore moved fails.
    let failed = false;
    const applyWithFailingRead = createApplyReconcile({
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        const state = await loadState(extensionRoot);
        if (
          !failed &&
          extensionRoot === project.extensionRoot &&
          state.marketplaces["mp"]?.plugins["ycore"]?.version === "2.0.0"
        ) {
          failed = true;
          throw new Error("read after the moves failed");
        }

        return state;
      },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithFailingRead({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });

    // assert
    assert.equal(failed, true);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● ycore v1.0.0 → v2.0.0 (updated)\n" +
          "  ◍ widget v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "newdep@mp" or uninstall "widget@mp"\n' +
          "\n" +
          "⊘ state.json [project] (failed) {unreadable}\n" +
          "  ⊘ state.json (failed) {unreadable}\n" +
          "    cause: read after the moves failed\n" +
          "\n" +
          "Reconcile: 2 failures, 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "newdep"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-26 / D-PL2-18: the move of a plugin that declares a record waiting on a missing dependency runs after that record's move and enable", async (t) => {
    // arrange
    const { cwd, project } = await seedWaitingDependencyMoves(t, "waiting-dependent-move", {
      offerMissing: true,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● cdep v1.0.0 (installed) {dependency installed}\n" +
          "  ● alib v1.0.0 → v2.0.0 (updated)\n" +
          "  ● alib v2.0.0 (installed)\n" +
          "  ● bapp v1.0.0 → v2.0.0 (updated)\n" +
          "\n" +
          "Reconcile: 4 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(await recordStates(project, ["alib", "bapp", "cdep"]), [
      ["2.0.0", true, undefined],
      ["2.0.0", true, undefined],
      ["1.0.0", true, undefined],
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-26 / D-PL2-18: a record whose missing dependency fails to install reports its move as skipped, and the move that declares it does not run", async (t) => {
    // arrange
    const { cwd, project } = await seedWaitingDependencyMoves(t, "waiting-dependent-held", {
      offerMissing: false,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ cdep (failed) {not in manifest}\n" +
          "  ⊘ alib v1.0.0 (skipped) {dependency failed}\n" +
          "  ◍ bapp v1.0.0 (disabled) {dependency failed}\n" +
          '    cause: "alib@mp" did not update; run apply again once it can, or uninstall "bapp@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 2 warnings\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await recordStates(project, ["alib", "bapp", "cdep"]), [
      ["1.0.0", false, true],
      ["1.0.0", false, true],
      [undefined, undefined, undefined],
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-08: a move after the install whose other dependency failed to move reports dependency failed and stays enabled", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(t, "after-blocked-move", {
      trees: {
        xapp: { skill: "clean" },
        alib: { skill: "clean" },
        ycore: { skill: "clean" },
        cdep: { skill: "clean" },
      },
      supported: { xapp: ["skills"], alib: ["skills"], ycore: ["skills"], cdep: ["skills"] },
      offered: { xapp: "2.0.0", alib: "2.0.0", ycore: "2.0.0" },
      dependencies: {
        xapp: [
          { name: "alib", version: "*" },
          { name: "ycore", version: "*" },
        ],
        alib: [{ name: "cdep", version: "*" }],
      },
      records: { alib: { enabled: false, dependencyDisabled: true } },
    });
    await withoutRecords(project, ["cdep"]);
    await declareEnabled(project, cwd, ["xapp", "alib", "ycore"]);
    await unreadableSkill(marketplaceRoot, "ycore");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ ycore v1.0.0 → v2.0.0 (failed) {permission denied}\n" +
          "  ● cdep v1.0.0 (installed) {dependency installed}\n" +
          "  ● alib v1.0.0 → v2.0.0 (updated)\n" +
          "  ● alib v2.0.0 (installed)\n" +
          "  ⊘ xapp v1.0.0 (skipped) {dependency failed}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 warning, 3 successes\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await recordStates(project, ["alib", "xapp", "ycore", "cdep"]), [
      ["2.0.0", true, undefined],
      ["1.0.0", true, undefined],
      ["1.0.0", true, undefined],
      ["1.0.0", true, undefined],
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-26: a held-down plugin whose move declares a record waiting on a missing dependency moves and comes back after it", async (t) => {
    // arrange
    const { cwd, project } = await seedWaitingDependencyMoves(t, "waiting-held-dependent", {
      offerMissing: true,
      dependentHeld: true,
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● cdep v1.0.0 (installed) {dependency installed}\n" +
          "  ● alib v1.0.0 → v2.0.0 (updated)\n" +
          "  ● alib v2.0.0 (installed)\n" +
          "  ● bapp v1.0.0 → v2.0.0 (updated)\n" +
          "\n" +
          "Reconcile: 4 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(await recordStates(project, ["alib", "bapp", "cdep"]), [
      ["2.0.0", true, undefined],
      ["2.0.0", true, undefined],
      ["1.0.0", true, undefined],
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-PL2-18: a held-down plugin whose missing dependency's install is refused reports its move as skipped after the refusal", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "waiting-install-refused", {
      trees: { alib: { skill: "clean" }, cdep: { skill: "clean" }, ycore: { skill: "clean" } },
      supported: { alib: ["skills"], cdep: ["skills"], ycore: ["skills"] },
      offered: { alib: "2.0.0" },
      dependencies: {
        alib: [{ name: "cdep", version: "*" }],
        cdep: [{ name: "ycore", version: "^2.0.0" }],
      },
      records: { alib: { enabled: false, dependencyDisabled: true } },
    });
    await withoutRecords(project, ["cdep"]);
    await declareEnabled(project, cwd, ["alib", "ycore"]);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ cdep (failed) {dependency failed}\n" +
          '    cause: Dependency "ycore@mp" is installed at version 1.0.0, which does not satisfy ^2.0.0.\n' +
          "  ⊘ alib v1.0.0 (skipped) {dependency failed}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 warning",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await recordStates(project, ["alib", "ycore", "cdep"]), [
      ["1.0.0", false, true],
      ["1.0.0", true, undefined],
      [undefined, undefined, undefined],
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("UPD-DEP-D1: a config install that moves its out-of-range dependency first reports the move as pending lists it", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(
      t,
      "install-moves-dependency",
      coShippedSeed(),
    );
    const state = await loadState(project.extensionRoot);
    const mp = state.marketplaces.mp;
    assert.ok(mp !== undefined);
    const { widget: _widget, ...recorded } = mp.plugins;
    mp.plugins = recorded;
    await saveState(project.extensionRoot, state);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● zcore v1.0.0 → v2.0.0 (updated)\n" +
          '    cause: constrained to the combined range (^2.0.0) -- required by "widget@mp"\n' +
          "  ● widget v1.1.0 (installed)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "zcore"))?.version,
        (await recordFor(project, "mp", "widget"))?.version,
      ],
      ["2.0.0", "1.1.0"],
    );
    verifyBoundary();
  });

  test("UPD-DEP-D1: a config install whose dependency's move fails reports the failed move and installs nothing", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "install-move-fails",
      coShippedSeed(),
    );
    const state = await loadState(project.extensionRoot);
    const mp = state.marketplaces.mp;
    assert.ok(mp !== undefined);
    const { widget: _widget, ...recorded } = mp.plugins;
    mp.plugins = recorded;
    await saveState(project.extensionRoot, state);
    await unreadableSkill(marketplaceRoot, "zcore");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ widget (failed) {dependency failed}\n" +
          '    cause: Dependency "zcore@mp" did not move into ^2.0.0.\n' +
          "  ⊘ zcore v1.0.0 → v2.0.0 (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "zcore"))?.version,
        await recordFor(project, "mp", "widget"),
      ],
      ["1.0.0", undefined],
    );
    verifyBoundary();
  });

  test("APPLY1-01: a dependency's failed move keeps its dependent where it is and disables it, naming the dependency", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-dependency-fails",
      coShippedSeed(),
    );
    await unreadableSkill(marketplaceRoot, "zcore");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'A plugin operation has failed.\n\n● mp [project]\n  ⊘ zcore v1.0.0 → v2.0.0 (failed) {permission denied}\n  ◍ widget v1.0.0 (disabled) {dependency failed}\n    cause: "zcore@mp" did not update; run apply again once it can, or uninstall "widget@mp"\n\nReconcile: 1 failure, 1 warning\n\n/reload to pick up changes',
        severity: "error",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual([widget?.version, widget?.enabled], ["1.0.0", false]);
    verifyBoundary();
  });

  test("APPLY1-01: a dependent whose own move fails after its dependency moved is disabled with the marker", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-dependent-fails",
      coShippedSeed(),
    );
    await unreadableSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● zcore v1.0.0 → v2.0.0 (updated)\n" +
          "  ⊘ widget v1.0.0 → v1.1.0 (failed) {permission denied}\n" +
          "  ◍ widget v1.0.0 (disabled) {dependency version unsatisfied}\n" +
          '    cause: The update of "widget@mp" did not install; run apply again once it can, or uninstall "widget@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual(
      [widget?.version, widget?.enabled, widget?.dependencyDisabled],
      ["1.0.0", false, true],
    );
    verifyBoundary();
  });

  test("APPLY1-01: a dependent whose failed move the dependency move was not made for stays enabled", async (t) => {
    // arrange -- `widget` declares `zcore` with no range, so the old `zcore`
    // meets it and the move is not made for it.
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(t, "cascade-unrelated", {
      ...coShippedSeed(),
      dependencies: { widget: [{ name: "zcore", version: "*" }] },
    });
    await unreadableSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● zcore v1.0.0 → v2.0.0 (updated)\n" +
          "  ⊘ widget v1.0.0 → v1.1.0 (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 1 failure, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "widget"))?.enabled, true);
    verifyBoundary();
  });

  test("APPLY1-01: held-down plugins that wait on a dependency's move are enabled in cascade order once it lands", async (t) => {
    // arrange -- `lib` needs core ^2.0.0, `app` needs `lib`; both sit held down
    // and neither moves itself.
    const { cwd, project } = await seedConvergenceScope(t, "cascade-enable-only", {
      trees: { app: { skill: "clean" }, lib: { skill: "clean" }, core: { skill: "clean" } },
      supported: { app: ["skills"], lib: ["skills"], core: ["skills"] },
      offered: { core: "2.0.0" },
      dependencies: {
        app: [{ name: "lib", version: "*" }],
        lib: [{ name: "core", version: "^2.0.0" }],
      },
      records: {
        app: { enabled: false, dependencyDisabled: true },
        lib: { enabled: false, dependencyDisabled: true },
      },
    });
    await declareEnabled(project, cwd, ["app", "lib", "core"]);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● core v1.0.0 → v2.0.0 (updated)\n" +
          "  ● lib v1.0.0 (installed)\n" +
          "  ● app v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 3 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    verifyBoundary();
  });

  test("APPLY1-01: held-down plugins that wait on a dependency's failed move stay disabled, and only the failed move is reported", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-enable-blocked",
      {
        trees: { app: { skill: "clean" }, lib: { skill: "clean" }, core: { skill: "clean" } },
        supported: { app: ["skills"], lib: ["skills"], core: ["skills"] },
        offered: { core: "2.0.0" },
        dependencies: {
          app: [{ name: "lib", version: "*" }],
          lib: [{ name: "core", version: "^2.0.0" }],
        },
        records: {
          app: { enabled: false, dependencyDisabled: true },
          lib: { enabled: false, dependencyDisabled: true },
        },
      },
    );
    await declareEnabled(project, cwd, ["app", "lib", "core"]);
    await unreadableSkill(marketplaceRoot, "core");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [project]\n  ⊘ core v1.0.0 → v2.0.0 (failed) {permission denied}\n\nReconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "app"))?.enabled,
        (await recordFor(project, "mp", "lib"))?.enabled,
      ],
      [false, false],
    );
    verifyBoundary();
  });

  test("APPLY1-01 / CR-B: a held-down dependency whose enable fails after the move it waited on keeps the plugin above it disabled", async (t) => {
    // arrange -- `lib` needs core ^2.0.0 and cannot be read; `app` needs `lib`.
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-enable-fails",
      {
        trees: { app: { skill: "clean" }, lib: { skill: "clean" }, core: { skill: "clean" } },
        supported: { app: ["skills"], lib: ["skills"], core: ["skills"] },
        offered: { core: "2.0.0" },
        dependencies: {
          app: [{ name: "lib", version: "*" }],
          lib: [{ name: "core", version: "^2.0.0" }],
        },
        records: {
          app: { enabled: false, dependencyDisabled: true },
          lib: { enabled: false, dependencyDisabled: true },
        },
      },
    );
    await declareEnabled(project, cwd, ["app", "lib", "core"]);
    await unreadableSkill(marketplaceRoot, "lib");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [project]\n  ● core v1.0.0 → v2.0.0 (updated)\n  ⊘ lib (failed) {unreadable}\n\nReconcile: 1 failure, 1 success\n\n/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "app"))?.enabled,
        (await recordFor(project, "mp", "lib"))?.enabled,
      ],
      [false, false],
    );
    verifyBoundary();
  });

  test("APPLY1-01 / WR-3: a held-down record whose enable fails keeps the copy its restored pin names", async (t) => {
    // arrange -- `widget` runs a per-commit copy under the plugin clones; its
    // pin refresh moves it to the marketplace's files, and its enable fails.
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-restored-copy",
      coShippedSeed({ enabled: false, dependencyDisabled: true }),
    );
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    const copy = path.join(project.pluginClonesDir, "widget-copy");
    await writeUnder(
      path.join(copy, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "widget", version: "1.0.0" }),
    );
    const seeded = await loadState(project.extensionRoot);
    const widget = seeded.marketplaces.mp?.plugins.widget;
    assert.ok(widget !== undefined);
    widget.resolvedSource = copy;
    widget.resolvedSha = "a".repeat(40);
    await saveState(project.extensionRoot, seeded);
    await unreadableSkill(marketplaceRoot, "widget");
    const { ctx, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    const restored = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual(
      [restored?.version, restored?.resolvedSource, restored?.resolvedSha, restored?.enabled],
      ["1.0.0", copy, "a".repeat(40), false],
    );
    assert.equal(await pathExists(copy), true);
    verifyBoundary();
  });

  test("D-PL2-25: an apply whose cascade and final judgement meet a refused installed copy report it once and move nothing", async (t) => {
    // arrange -- `widget` runs a per-commit copy whose manifest links outside
    // its plugin directory, and both plugins have a catalog move
    const { cwd, project } = await seedConvergenceScope(t, "refused-copy-moves", {
      ...coShippedSeed(),
      dependencies: {},
    });
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    await pinWidgetToEscapingCopy(project, cwd);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [REFUSED_WIDGET_COPY_NOTIFICATION]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "widget"))?.enabled,
        (await recordFor(project, "mp", "zcore"))?.version,
      ],
      [true, "1.0.0"],
    );
    verifyBoundary();
  });

  test("D-PL2-25: an apply whose final judgement alone meets a refused installed copy reports it once", async (t) => {
    // arrange -- as above, with no catalog move for either plugin
    const { cwd, project } = await seedConvergenceScope(t, "refused-copy-steady", {
      ...coShippedSeed(),
      offered: { widget: "1.0.0", zcore: "1.0.0" },
      dependencies: {},
    });
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    await pinWidgetToEscapingCopy(project, cwd);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [REFUSED_WIDGET_COPY_NOTIFICATION]);
    assert.equal((await recordFor(project, "mp", "widget"))?.enabled, true);
    verifyBoundary();
  });

  test("APPLY1-01 / Review 4 WR-2: a clone cleanup that fails after a held-down step does not end the apply", async (t) => {
    // arrange -- as the restored-copy case, with a plugin-clones directory
    // nobody may list, so the deferred cleanup fails.
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      throw new Error("a directory mode cannot stop root; run this suite as a non-root user");
    }

    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-cleanup-fails",
      coShippedSeed({ enabled: false, dependencyDisabled: true }),
    );
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    const copy = path.join(project.pluginClonesDir, "widget-copy");
    await writeUnder(
      path.join(copy, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "widget", version: "1.0.0" }),
    );
    const seeded = await loadState(project.extensionRoot);
    const widget = seeded.marketplaces.mp?.plugins.widget;
    assert.ok(widget !== undefined);
    widget.resolvedSource = copy;
    widget.resolvedSha = "a".repeat(40);
    await saveState(project.extensionRoot, seeded);
    await unreadableSkill(marketplaceRoot, "widget");
    await chmod(project.pluginClonesDir, 0o300);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act -- the mode comes back before the case's tree is removed
    try {
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    } finally {
      await chmod(project.pluginClonesDir, 0o755);
    }

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [project]\n  ● zcore v1.0.0 → v2.0.0 (updated)\n  ⊘ widget v1.0.0 → v1.1.0 (failed) {unreadable}\n\nReconcile: 1 failure, 1 success\n\n/reload to pick up changes",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });

  test("APPLY1-01 / CR-03 / WR-C: a held-down record whose enable fails after its pin refresh is a failed move and keeps its version", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-deferred-fails",
      coShippedSeed({ enabled: false, dependencyDisabled: true }),
    );
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    await unreadableSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [project]\n  ● zcore v1.0.0 → v2.0.0 (updated)\n  ⊘ widget v1.0.0 → v1.1.0 (failed) {unreadable}\n\nReconcile: 1 failure, 1 success\n\n/reload to pick up changes",
        severity: "error",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual([widget?.version, widget?.enabled], ["1.0.0", false]);
    verifyBoundary();
  });

  test("D-PL2-18 / WR-02: a held-down record whose supported set grew is re-materialized and enabled after the move it waits on", async (t) => {
    // arrange -- `widget` keeps its catalog version but its tree gained a command
    const { cwd, project } = await seedConvergenceScope(t, "cascade-deferred-grown", {
      ...coShippedSeed({ enabled: false, dependencyDisabled: true }),
      trees: { widget: { skill: "clean", command: true }, zcore: { skill: "clean" } },
      offered: { zcore: "2.0.0" },
    });
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ● zcore v1.0.0 → v2.0.0 (updated)\n  ● widget v1.0.0 (installed)\n\nReconcile: 2 successes\n\n/reload to pick up changes",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual([widget?.version, widget?.enabled], ["1.0.0", true]);
    assert.ok(widget?.compatibility.supported.includes("commands"));
    verifyBoundary();
  });

  test("D-PL2-18 / WR-C: a held-down record whose growth-only enable fails keeps its version and commit", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-deferred-grown-fails",
      {
        ...coShippedSeed({ enabled: false, dependencyDisabled: true }),
        trees: { widget: { skill: "clean", command: true }, zcore: { skill: "clean" } },
        offered: { zcore: "2.0.0" },
      },
    );
    await declareEnabled(project, cwd, ["widget", "zcore"]);
    await unreadableSkill(marketplaceRoot, "widget");
    const before = await recordFor(project, "mp", "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n● mp [project]\n  ● zcore v1.0.0 → v2.0.0 (updated)\n  ⊘ widget v1.0.0 (failed) {unreadable}\n\nReconcile: 1 failure, 1 success\n\n/reload to pick up changes",
        severity: "error",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual(
      [widget?.version, widget?.resolvedSha, widget?.enabled],
      [before?.version, before?.resolvedSha, false],
    );
    verifyBoundary();
  });

  test("APPLY1-01 / WR-C: a pin restore that cannot take the state lock is reported and later steps still run", async (t) => {
    // arrange -- `widget`'s enable fails, and the restore after it is refused
    const seed = coShippedSeed({ enabled: false, dependencyDisabled: true });
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-restore-lock-held",
      {
        ...seed,
        trees: { ...seed.trees, yonder: { skill: "clean" } },
        supported: { ...seed.supported, yonder: ["skills"] },
        offered: { ...seed.offered, yonder: "1.1.0" },
        records: { ...seed.records, yonder: { enabled: false, dependencyDisabled: true } },
      },
    );
    await declareEnabled(project, cwd, ["widget", "yonder", "zcore"]);
    await unreadableSkill(marketplaceRoot, "widget");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();
    const restoreDeferredPin = (): Promise<void> => {
      throw new StateLockHeldError("project", ".state-lock");
    };

    // act
    await applyReconcile({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
      restoreDeferredPin,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n● mp [project]\n  ● zcore v1.0.0 → v2.0.0 (updated)\n  ⊘ widget v1.0.0 → v1.1.0 (failed) {unreadable}\n  ● yonder v1.0.0 → v1.1.0 (updated)\n\n⊘ state.json [project] (failed) {lock held}\n  ⊘ state.json (failed) {lock held}\n    cause: Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.\n\nReconcile: 3 failures, 2 successes\n\n/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "yonder"))?.enabled, true);
    verifyBoundary();
  });

  test("APPLY1-01 / CR-01: a dependent whose own move is held is disabled with its dependents when the dependency fails", async (t) => {
    // arrange -- `host` holds `widget` at ^1.0.0; `widget` 2.0.0 needs zcore ^2.0.0.
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "cascade-held-dependent",
      {
        trees: { host: { skill: "clean" }, widget: { skill: "clean" }, zcore: { skill: "clean" } },
        supported: { host: ["skills"], widget: ["skills"], zcore: ["skills"] },
        offered: { widget: "2.0.0", zcore: "2.0.0" },
        dependencies: {
          host: [{ name: "widget", version: "^1.0.0" }],
          widget: [{ name: "zcore", version: "^2.0.0" }],
        },
      },
    );
    await unreadableSkill(marketplaceRoot, "zcore");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          'A plugin operation has failed.\n\n● mp [project]\n  ⊘ zcore v1.0.0 → v2.0.0 (failed) {permission denied}\n  ◍ host v1.0.0 (disabled) {dependency unsatisfied}\n    cause: Enable "widget@mp" or uninstall "host@mp"\n  ◍ widget v1.0.0 (disabled) {dependency failed}\n    cause: "zcore@mp" did not update; run apply again once it can, or uninstall "widget@mp"\n\nReconcile: 1 failure, 2 warnings\n\n/reload to pick up changes',
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(
      [
        (await recordFor(project, "mp", "host"))?.enabled,
        (await recordFor(project, "mp", "widget"))?.enabled,
      ],
      [false, false],
    );
    verifyBoundary();
  });

  test("APPLY1-01: a dependent held down by an earlier pass is enabled after the move it waits on lands", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(
      t,
      "cascade-deferred",
      coShippedSeed({ enabled: false, dependencyDisabled: true }),
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: path.join(cwd, "mp-src") } },
        plugins: { "widget@mp": {}, "zcore@mp": {} },
      }),
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● zcore v1.0.0 → v2.0.0 (updated)\n" +
          "  ● widget v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 2 successes\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const widget = await recordFor(project, "mp", "widget");
    assert.deepStrictEqual([widget?.version, widget?.enabled], ["1.1.0", true]);
    verifyBoundary();
  });

  test("APL-02 / D-08: a path-source plugin the catalog moved is updated, recorded and reported with the reload trailer", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-move", {
      trees: { demo: { skill: "clean" } },
      supported: { demo: ["skills"] },
      offered: { demo: "1.1.0" },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● demo v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "demo"))?.version, "1.1.0");
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-08 / NFR-3: a second apply after a move has nothing to change", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-settled", {
      trees: { demo: { skill: "clean" } },
      supported: { demo: ["skills"] },
      offered: { demo: "1.1.0" },
    });
    const { gitOps } = createOfflineGitOps();
    await applyReconcile({
      ctx: createNotificationBoundary(1).ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps,
    });
    const settled = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settled);
    verifyBoundary();
  });

  test("D-12: a range-blocked move and a consent-needing move stay put with warning rows and write nothing", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(t, "converge-blocked", {
      trees: { app: { skill: "clean" }, lib: { skill: "clean" }, styled: { skill: "clean" } },
      supported: { app: ["skills"], lib: ["skills"], styled: ["skills"] },
      offered: { lib: "2.0.0", styled: "1.1.0" },
      dependencies: { app: [{ name: "lib", version: "^1.0.0" }] },
    });
    await writeUnder(
      path.join(marketplaceRoot, "plugins", "styled", ".lsp.json"),
      JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
    );
    const before = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations need attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ lib v1.0.0 (skipped) {dependents constrain}\n" +
          '    cause: version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@mp"\n' +
          "  ● styled v1.0.0 (partially-upgradable) {lsp}\n" +
          "    Run update --partial on this plugin to update it with the supported components.\n" +
          "\n" +
          "Reconcile: 2 warnings",
        severity: "warning",
      },
    ]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), before);
    verifyBoundary();
  });

  test("D-12 / D-06: a held dependent's stricter catalog copy holds the move on every apply, and the dependent stays enabled", async (t) => {
    // arrange -- `zzhost` holds `widget`, whose installed copy declares `zcore`
    // with no range while its catalog copy declares `zcore@^1.0.0`. Moving
    // `zcore` would leave the load-time check reading `widget`'s catalog copy
    // as broken, so the move stays held.
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(t, "converge-held-copy", {
      trees: { widget: { skill: "clean" }, zcore: { skill: "clean" }, zzhost: { skill: "clean" } },
      supported: { widget: ["skills"], zcore: ["skills"], zzhost: ["skills"] },
      offered: { widget: "1.1.0", zcore: "2.0.0" },
      dependencies: {
        widget: [{ name: "zcore", version: "^1.0.0" }],
        zzhost: [{ name: "widget", version: "~1.0.0" }],
      },
    });
    const installedCopy = path.join(marketplaceRoot, "plugins", "widget-installed");
    await writeUnder(
      path.join(installedCopy, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "widget", version: "1.0.0", dependencies: ["zcore"] }),
    );
    const seeded = await loadState(project.extensionRoot);
    const widget = seeded.marketplaces.mp?.plugins.widget;
    assert.ok(widget !== undefined);
    widget.resolvedSource = installedCopy;
    await saveState(project.extensionRoot, seeded);
    const before = await readFile(project.stateJsonPath, "utf8");
    const held = {
      message:
        "Some plugin operations need attention.\n" +
        "\n" +
        "● mp [project]\n" +
        "  ⊘ widget v1.0.0 (skipped) {dependents constrain}\n" +
        '    cause: version 1.1.0 falls outside what the combined range admits (~1.0.0) -- required by "zzhost@mp"\n' +
        "  ⊘ zcore v1.0.0 (skipped) {dependents constrain}\n" +
        '    cause: version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "widget@mp"\n' +
        "\n" +
        "Reconcile: 2 warnings",
      severity: "warning",
    };
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [held, held]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), before);
    verifyBoundary();
  });

  test("WR-01 / NFR-3: a state read that fails before the convergence reports a state.json row, never nothing to change", async (t) => {
    // arrange -- the read pass reads the scope first, the convergence second.
    const { cwd, project } = await seedConvergenceScope(t, "converge-unreadable", {
      trees: { demo: { skill: "clean" } },
      supported: { demo: ["skills"] },
      offered: { demo: "1.1.0" },
    });
    let reads = 0;
    const applyWithFailingConvergenceRead = createApplyReconcile({
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        reads += extensionRoot === project.extensionRoot ? 1 : 0;
        if (reads === 2) {
          throw Object.assign(new Error("EACCES: permission denied, open 'state.json'"), {
            code: "EACCES",
          });
        }

        return loadState(extensionRoot);
      },
    });
    const before = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await applyWithFailingConvergenceRead({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      scope: "project",
      gitOps: createOfflineGitOps().gitOps,
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ state.json [project] (failed) {permission denied}\n" +
          "  ⊘ state.json (failed) {permission denied}\n" +
          "    cause: EACCES: permission denied, open 'state.json'\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.equal(reads, 2);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), before);
    verifyBoundary();
  });

  test("D-13: a move that fails to materialize reports its reason and the next move still runs", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(t, "converge-failed", {
      trees: { alpha: { skill: "clean", command: true }, beta: { skill: "clean" } },
      supported: { alpha: ["skills", "commands"], beta: ["skills"] },
      offered: { alpha: "1.1.0", beta: "1.1.0" },
    });
    const unreadable = path.join(marketplaceRoot, "plugins", "alpha", "commands", "deploy.md");
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      throw new Error("an unreadable file cannot deny root; run this suite as a non-root user");
    }

    // An unreadable file still unlinks, so the tree removal needs no restore.
    await chmod(unreadable, 0o000);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ alpha v1.0.0 → v1.1.0 (failed) {permission denied}\n" +
          "  ● beta v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 1 failure, 1 success\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "alpha"))?.version, "1.0.0");
    assert.equal((await recordFor(project, "mp", "beta"))?.version, "1.1.0");
    verifyBoundary();
  });

  test("D-10 / D-25 / WCONV-03: a plugin whose supported set grew is re-materialized at its recorded version with the backfill row", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-grown", {
      trees: { demo: { skill: "clean", command: true } },
      supported: { demo: ["skills"] },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● demo v1.0.0 (installed) {components now supported}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const record = await recordFor(project, "mp", "demo");
    assert.equal(record?.version, "1.0.0");
    assert.deepStrictEqual(record.resources.prompts, ["demo:deploy"]);
    assert.ok(record.compatibility.supported.includes("commands"));
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WCONV-03: a revision move whose supported set also grew leads its updated row with the growth marker", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-grown-move", {
      trees: { demo: { skill: "clean", command: true } },
      supported: { demo: ["skills"] },
      offered: { demo: "1.1.0" },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● demo v1.0.0 → v1.1.0 (updated) {components now supported}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "demo"))?.version, "1.1.0");
    verifyBoundary();
  });

  for (const { move, offered, row } of [
    {
      move: "growth",
      offered: undefined,
      row: "  ● demo v1.0.0 (installed) {components now supported}\n",
    },
    {
      move: "revision",
      offered: "1.1.0",
      row: "  ● demo v1.0.0 → v1.1.0 (updated) {components now supported}\n",
    },
  ]) {
    test(`PKD-02: a ${move} move whose package step leaves a note reports it as a staging warning`, async (t) => {
      // arrange
      const { cwd, marketplaceRoot } = await seedConvergenceScope(t, `converge-${move}-packages`, {
        trees: { demo: { skill: "clean", command: true } },
        supported: { demo: ["skills"] },
        ...(offered !== undefined && { offered: { demo: offered } }),
      });
      const pluginRoot = path.join(marketplaceRoot, "plugins", "demo");
      await writeFile(
        path.join(pluginRoot, "package.json"),
        JSON.stringify({ name: "demo", dependencies: { "pkd-dep": "1.0.0" } }),
      );
      await writeFile(path.join(pluginRoot, "package-lock.json"), '{"lockfileVersion":3}');
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
      const { gitOps } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n" +
            row +
            "\n" +
            "Reconcile: 1 success\n" +
            "\n" +
            "/reload to pick up changes",
        },
        {
          message:
            'Plugin "demo" [project] updated; 1 declared component has a note.\n' +
            "\n" +
            'Skipped installing this plugin\'s dependencies: its folder in the marketplace "mp" is outside the folders this extension manages, so it was not changed. To install them, run "npm ci --ignore-scripts --workspaces=false --no-audit --no-fund" in that folder.',
          severity: "warning",
        },
      ]);
      verifyBoundary();
    });
  }

  test("D-12 / D-25: a partial record whose supported set grew stays partial and names the kinds it still lacks", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-grown-partial", {
      trees: { demo: { skill: "clean", command: true, lsp: true } },
      supported: { demo: ["skills"] },
      records: { demo: { installable: false, unsupported: ["lspServers"] } },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◉ demo v1.0.0 (partially-installed) {components now supported, lsp}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const record = await recordFor(project, "mp", "demo");
    assert.equal(record?.compatibility.installable, false);
    assert.deepStrictEqual(record.resources.prompts, ["demo:deploy"]);
    verifyBoundary();
  });

  test("WCONV-01 / T-29-33: a clean record whose grown candidate is partially available is declined, not degraded", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-grown-consent", {
      trees: { demo: { skill: "clean", command: true, lsp: true } },
      supported: { demo: ["skills"] },
    });
    const before = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● demo v1.0.0 (partially-upgradable) {lsp}\n" +
          "    Run update --partial on this plugin to update it with the supported components.\n" +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), before);
    verifyBoundary();
  });

  test("ENBL-08: a disabled record whose supported set grew is never re-materialized", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-grown-disabled", {
      trees: { demo: { skill: "clean", command: true } },
      supported: { demo: ["skills"] },
      records: { demo: { enabled: false } },
    });
    const before = await readFile(project.stateJsonPath, "utf8");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), before);
    verifyBoundary();
  });

  test("APL-02 / D-19: a partial record whose new version needs nothing unsupported is moved and recorded whole", async (t) => {
    // arrange
    const { cwd, project } = await seedConvergenceScope(t, "converge-made-whole", {
      trees: { demo: { skill: "clean" } },
      supported: { demo: ["skills"] },
      offered: { demo: "1.1.0" },
      records: { demo: { installable: false, unsupported: ["outputStyles"] } },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● demo v1.0.0 → v1.1.0 (updated)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    const record = await recordFor(project, "mp", "demo");
    assert.equal(record?.version, "1.1.0");
    assert.equal(record.compatibility.installable, true);
    assert.deepStrictEqual(record.compatibility.unsupported, []);
    verifyBoundary();
  });

  test("D-13: a growth move that fails to materialize reports its reason and the record keeps its supported set", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "converge-grown-failed",
      {
        trees: { demo: { skill: "clean", command: true } },
        supported: { demo: ["skills"] },
      },
    );
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      throw new Error("an unreadable file cannot deny root; run this suite as a non-root user");
    }

    // An unreadable file still unlinks, so the tree removal needs no restore.
    await chmod(path.join(marketplaceRoot, "plugins", "demo", "commands", "deploy.md"), 0o000);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ demo v1.0.0 (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "demo"))?.compatibility.supported, [
      "skills",
    ]);
    verifyBoundary();
  });

  test("SURF-05 / WARN-01: a growth move names the orphan rewake and the malformed skill its re-materialize produced", async (t) => {
    // arrange
    const { cwd } = await seedConvergenceScope(t, "converge-grown-signals", {
      trees: { demo: { skill: "malformed", orphanRewakeHooks: true } },
      supported: { demo: ["skills"] },
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● demo v1.0.0 (installed) {components now supported, orphan rewake, malformed skill}\n" +
          "\n" +
          "Reconcile: 1 warning\n" +
          "\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    verifyBoundary();
  });

  test("RECON-04 / ENBL-08: a plugin the same apply disables is not re-materialized for its grown set", async (t) => {
    // arrange
    const { cwd, project, marketplaceRoot } = await seedConvergenceScope(
      t,
      "converge-grown-toggled",
      {
        trees: { demo: { skill: "clean", command: true } },
        supported: { demo: ["skills"] },
      },
    );
    await writeUnder(
      project.baseConfigJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "demo@mp": { enabled: false } },
      }),
    );
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ demo v1.0.0 (disabled)\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "demo"))?.compatibility.supported, [
      "skills",
    ]);
    verifyBoundary();
  });

  test("AFILE-04: a growth move that rewrites a commented mcp-adapter.json shows the notice after the cascade", async (t) => {
    // arrange
    const { cwd } = await seedCommentedAdapterScope(t, "afile-growth", {
      trees: { alfa: { skill: "clean", mcpServer: true } },
      declared: { "alfa@mp": {} },
      recorded: { alfa: { mcpServers: ["alfa-echo"] } },
      owners: ["alfa"],
    });
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● alfa v1.0.0 (installed) {components now supported, requires pi-mcp-adapter}\n" +
          "\n" +
          "Reconcile: 1 success\n" +
          "\n" +
          "/reload to pick up changes",
      },
      COMMENTS_REMOVED_NOTICE,
    ]);
    verifyBoundary();
  });

  test("WR-05: an apply over a declared scope that records nothing brings no state.json into existence", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "converge-no-state");
    await writeUnder(project.baseConfigJsonPath, configBytes({ marketplaces: {} }));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [APPLY_EMPTY_NOTICE]);
    assert.equal(await pathExists(project.stateJsonPath), false);
    verifyBoundary();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D-PL2-09: the missing-dependency step over one scope that a marketplace add
// runs. It drives the same `applyDependencyInstalls` the apply pass drives, so
// these cases prove the read, the selection, the rows, and the read failure.
// ───────────────────────────────────────────────────────────────────────────

describe("createScopeDependencyInstall", () => {
  /** The step bound to `reader` and a fresh lifecycle, as the entry point binds it. */
  function scopeDependencyInstall(
    reader: ReconcileStateReader = { loadState },
  ): ScopeDependencyInstallFn {
    return createScopeDependencyInstall(reader, {
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });
  }

  /** A project scope recording `deploy-kit@mp`, whose declared dependency is not installed. */
  async function seedDeployKitScope(
    t: TestContext,
    label: string,
    trees: Readonly<Record<string, PluginTree>>,
  ): Promise<Pick<HermeticScopes, "cwd" | "project">> {
    const { cwd, project } = await seedCommentedAdapterScope(t, label, {
      trees,
      declared: { "deploy-kit@mp": {} },
      recorded: { "deploy-kit": { supported: ["skills"] } },
      owners: [],
    });
    return { cwd, project };
  }

  /** Runs the step over the project scope; it emits nothing of its own. */
  async function runStep(
    step: ScopeDependencyInstallFn,
    cwd: string,
    select: (install: { readonly plugin: string; readonly marketplace: string }) => boolean,
  ): Promise<ScopeDependencyInstallResult> {
    const { ctx, verifyBoundary } = createNotificationBoundary(0);
    const scopeInstall = await step({
      ctx,
      run: runWithNothingLoaded(),
      scope: "project",
      cwd,
      select,
    });
    verifyBoundary();
    return scopeInstall;
  }

  test("installs a selected missing dependency and reports it by its full key", async (t) => {
    // arrange
    const { cwd, project } = await seedDeployKitScope(t, "scope-step-install", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    const selected: string[] = [];

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, (install) => {
      selected.push(`${install.plugin}@${install.marketplace}`);
      return true;
    });

    // assert
    assert.deepStrictEqual(selected, ["secrets-vault@mp"]);
    assert.deepStrictEqual(scopeInstall, {
      rows: [
        {
          status: "installed",
          name: "secrets-vault@mp",
          version: "1.0.0",
          dependencies: [],
          reasons: ["dependency installed"],
          severity: "info",
          needsReload: true,
        },
      ],
      mcpConfigNotices: [],
    });
    const secretsVault = await recordFor(project, "mp", "secrets-vault");
    assert.equal(secretsVault?.provenance, "dependency");
    assert.equal(secretsVault?.enabled, true);
  });

  test("D-PL10-19: returns tagged warnings from a selected missing dependency", async (t) => {
    // arrange
    const { cwd } = await seedDeployKitScope(t, "scope-step-warning", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "malformed" },
    });

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => true);

    // assert
    assert.deepStrictEqual(
      scopeInstall.stagingDiagnostics?.map(({ plugin, scope, verb, warnings }) => ({
        plugin,
        scope,
        verb,
        warningKinds: warnings.map((warning) => warning.kind),
      })),
      [
        {
          plugin: "secrets-vault",
          scope: "project",
          verb: "installed",
          warningKinds: ["hygiene"],
        },
      ],
    );
  });

  test("leaves a missing dependency the request does not select uninstalled", async (t) => {
    // arrange
    const { cwd, project } = await seedDeployKitScope(t, "scope-step-unselected", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => false);

    // assert
    assert.deepStrictEqual(scopeInstall, { rows: [], mcpConfigNotices: [] });
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
  });

  test("reports nothing for a scope with neither a state file nor a config", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "scope-step-pristine");

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => true);

    // assert
    assert.deepStrictEqual(scopeInstall, { rows: [], mcpConfigNotices: [] });
    assert.equal(await pathExists(project.stateJsonPath), false);
  });

  test("reports nothing for a scope whose config is invalid", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "scope-step-invalid-config");
    await writeUnder(project.baseConfigJsonPath, "{");

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => true);

    // assert
    assert.deepStrictEqual(scopeInstall, { rows: [], mcpConfigNotices: [] });
  });

  test("D-PL2-11: a refused install reports the failed row apply reports, with its cause", async (t) => {
    // arrange -- secrets-vault declares crypto-core, which mp does not declare.
    const { cwd, project } = await seedDeployKitScope(t, "scope-step-refused", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { dependencies: ["crypto-core"], skill: "clean" },
    });

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => true);

    // assert
    const [row, ...rest] = scopeInstall.rows;
    assert.deepStrictEqual(rest, []);
    assert.equal(row?.status, "failed");
    const { cause, ...fields } = row;
    assert.deepStrictEqual(fields, {
      status: "failed",
      name: "secrets-vault@mp",
      reasons: ["dependency failed"],
      severity: "error",
      needsReload: false,
    });
    assert.equal(cause?.message, 'Dependency "crypto-core@mp" is not declared by its marketplace.');
    assert.deepStrictEqual(scopeInstall.mcpConfigNotices, []);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
  });

  for (const { thrown, failure, reason } of [
    {
      thrown: "a plain error",
      failure: new Error("state.json is mid-write"),
      reason: "unreadable",
    },
    {
      thrown: "a held state lock",
      failure: new StateLockHeldError("project", ".state-lock"),
      reason: "lock held",
    },
  ] as const) {
    test(`D-PL2-20: a read that throws ${thrown} reports apply's state.json row as ${reason} and installs nothing`, async (t) => {
      // arrange
      const { cwd, project } = await seedDeployKitScope(t, "scope-step-read-fails", {
        "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
        "secrets-vault": { skill: "clean" },
      });
      const step = scopeDependencyInstall({ loadState: () => Promise.reject(failure) });

      // act
      const scopeInstall = await runStep(step, cwd, () => true);

      // assert
      const [row, ...rest] = scopeInstall.rows;
      assert.deepStrictEqual(rest, []);
      assert.equal(row?.status, "failed");
      const { cause, ...fields } = row;
      assert.deepStrictEqual(fields, {
        status: "failed",
        name: "state.json",
        reasons: [reason],
        severity: "error",
        needsReload: false,
      });
      assert.equal(cause?.message, failure.message);
      assert.deepStrictEqual(scopeInstall.mcpConfigNotices, []);
      assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    });
  }

  test("AFILE-04: returns the MCP config notices its installs produced", async (t) => {
    // arrange
    const { cwd } = await seedDeployKitScope(t, "scope-step-notices", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { mcpServer: true },
    });

    // act
    const scopeInstall = await runStep(scopeDependencyInstall(), cwd, () => true);

    // assert
    assert.deepStrictEqual(scopeInstall.mcpConfigNotices, [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
    ]);
    assert.deepStrictEqual(
      scopeInstall.rows.map((row) => [row.status, row.name]),
      [["installed", "secrets-vault@mp"]],
    );
  });
});
