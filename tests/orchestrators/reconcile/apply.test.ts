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
//   invalid-block            unparseable base / local configuration, an
//                            unparseable state file, a held scope lock, a
//                            refused first-run configuration write, and the
//                            routing rebuild's own isolated failure
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
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import lockfile from "proper-lockfile";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createUninstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createApplyReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
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
import { StateLockHeldError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { HooksRouting } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type * as ApplyOrchestrator from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import type { ReconcileStateReader } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import type {
  ApplyReconcileOptions,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
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
    { kind: "test" as const, path: "tests" },
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

/** Run one isolated reconcile lifecycle with a fresh production routing owner. */
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
  t.after(async () => {
    for (const directory of denied) {
      await chmod(directory, 0o755);
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
  };
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

function pluginRecord(seed: RecordSeed): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: seed.pluginRoot,
    compatibility: {
      installable: seed.installable ?? true,
      notes: [],
      supported: [...(seed.supported ?? [])],
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
}): MarketplaceRecord {
  return {
    name: options.marketplace,
    scope: options.scope,
    source: pathSource(options.rawSource),
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
  const loaded = await loadConfig(locations.configJsonPath);
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

/**
 * The atomic writer names its temporary file `<basename>.<random>` and the
 * EACCES message quotes that name, so the digits differ per run. Replacing them
 * keeps the assertion a whole-value comparison rather than a pattern match.
 */
function withoutTempSuffix(message: string): string {
  return message.replaceAll(/claude-plugins\.json\.\d+/g, "claude-plugins.json.<tmp>");
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
      path: "tests/orchestrators/plugin/bootstrap.test.ts",
      symbol: "bootstrapClaudePlugin",
    },
    {
      kind: "test",
      path: "tests/orchestrators/reconcile/apply.test.ts",
      symbol: "applyReconcile",
    },
  ]);
});

test("apply.ts exposes the reconcile factory and no composed value", async () => {
  // arrange
  const applyModule =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts");

  // act
  const exportNames = Object.keys(applyModule);

  // assert
  assert.deepStrictEqual(exportNames, ["createApplyReconcile"]);
});

describe("applyReconcile", () => {
  test("WR-05: leaves a scope with neither a state file nor a configuration file untouched and silent", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "pristine");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("CFG-03: reports an unparseable base configuration by basename, skips that scope's apply pass, and removes nothing", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "invalid-base");
    const seeded: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    await writeUnder(project.configJsonPath, "{");
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    assert.equal(await readFile(project.configJsonPath, "utf8"), "{");
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("CFG-03: reports a schema-invalid local configuration alongside an unparseable base one, each on its own row", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "invalid-both");
    const seeded: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    };
    await seedState(project, seeded);
    await writeUnder(project.configJsonPath, "{");
    await writeUnder(project.configLocalJsonPath, JSON.stringify({ schemaVersion: 1, plugins: 7 }));
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
          "⊘ claude-plugins.local.json [project] (failed) {invalid manifest}\n" +
          "  ⊘ claude-plugins.local.json (failed) {invalid manifest}\n" +
          "    cause: schema validation failed: /plugins: must be object\n" +
          "\n" +
          "Reconcile: 4 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("CFG-03: reports a schema-invalid local configuration on its own when the base file is valid", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "invalid-local");
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(project.configLocalJsonPath, JSON.stringify({ schemaVersion: 1, plugins: 7 }));
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ claude-plugins.local.json [project] (failed) {invalid manifest}\n" +
          "  ⊘ claude-plugins.local.json (failed) {invalid manifest}\n" +
          "    cause: schema validation failed: /plugins: must be object\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-01: an unparseable state file in one scope reports unparseable and never stops the sibling scope reconciling", async (t) => {
    // arrange
    const { cwd, project, user } = await createHermeticScopes(t, "corrupt-state");
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(project.stateJsonPath, "{ not json");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
      cwd,
      "user-src",
      "user-mp",
      {},
    );
    await writeUnder(user.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(user, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, gitOps });

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

  test("WR-01: a scope lock held by another process reports lock held rather than falling back to unparseable", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "lock-held");
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const release = await lockfile.lock(project.extensionRoot, {
      lockfilePath: path.join(project.extensionRoot, ".state-lock"),
      realpath: false,
    });
    t.after(async () => {
      await release();
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ state.json [project] (failed) {lock held}\n" +
          "  ⊘ state.json (failed) {lock held}\n" +
          "    cause: Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.\n" +
          "\n" +
          "Reconcile: 2 failures",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("MIG-01: a first-run configuration write blocked by permissions names the configuration file, not the state file", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "migrate-refused");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    await denyWrites(project.scopeRoot);
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(
      notifications.map((notification) => ({
        ...notification,
        message: withoutTempSuffix(notification.message),
      })),
      [
        {
          message:
            "Some operations have failed.\n" +
            "\n" +
            "⊘ claude-plugins.json [project] (failed) {permission denied}\n" +
            "  ⊘ claude-plugins.json (failed) {permission denied}\n" +
            "    cause: EACCES: permission denied, open 'claude-plugins.json.<tmp>'\n" +
            "\n" +
            "Reconcile: 2 failures",
          severity: "error",
        },
      ],
    );
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
        project.configJsonPath,
        configBytes({
          marketplaces: Object.fromEntries(keys.map((key) => [key, { source: sources[key]! }])),
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        lastReconciledExtensionVersion: EXTENSION_VERSION,
        marketplaces: {},
      });
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
      project.configJsonPath,
      configBytes({
        marketplaces: {
          "local-mp": { source: local.marketplaceRoot },
          "remote-mp": { source: "acme/remote" },
        },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const unreachable = new Error("connect ENETUNREACH");
    (unreachable as { code?: string }).code = "ENETUNREACH";
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/remote.git"],
      cloneError: unreachable,
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] (removed)\n" +
          "  ○ hello (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes",
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

  test("D-22-02: a removal that unstages one plugin and is refused on another renders both children under a bare failed header", async (t) => {
    // arrange
    const { cwd, denyWrites, project } = await createHermeticScopes(t, "remove-partial");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      good: { skill: "clean" },
      stuck: { hooks: true },
    });
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
          "Reconcile: 2 failures, 1 success",
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
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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

  test("LOAD-03: a config-driven uninstall of a still-declared plugin proceeds and the next pass holds the dependent down", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-still-declared");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      keeper: { skill: "clean", dependencies: ["orphan"] },
      orphan: { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "keeper@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          plugins: {
            keeper: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "keeper") }),
            orphan: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") }),
          },
        }),
      },
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 6);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    const afterSecond = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" + "  ○ orphan v1.0.0 (uninstalled)\n" + "\n" + "Reconcile: 1 success",
      },
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ keeper v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "orphan@mp" or uninstall "keeper@mp"\n' +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    // LOAD-03: the removal happened on the FIRST pass -- the reconcile-driven
    // uninstall no longer refuses -- and the row that reports the consequence
    // for `keeper` is the load-time check's, on the next pass (D-06-06).
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), ["keeper"]);
    assert.equal(afterFirst.marketplaces["mp"]?.plugins["keeper"]?.enabled, true);
    assert.equal(afterSecond.marketplaces["mp"]?.plugins["keeper"]?.enabled, false);
    assert.equal(afterSecond.marketplaces["mp"]?.plugins["keeper"]?.dependencyDisabled, true);
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
      project.configJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {
        mp: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "mp",
          rawSource: marketplaceRoot,
          manifestPath,
          marketplaceRoot,
          // D-03-07 post-order: the dependency's record precedes its declarer's,
          // which used to be the ORDER THAT REFUSED -- removing `orphan` first
          // met a still-recorded `keeper` that declared it. LOAD-03 removed
          // that refusal, so the bucket now settles in plain record order and
          // the retry loop has nothing to retry.
          plugins: {
            orphan: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") }),
            keeper: pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "keeper") }),
          },
        }),
      },
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ orphan v1.0.0 (uninstalled)\n" +
          "  ○ keeper v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes",
      },
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "keeper@mp": {} },
      }),
    );
    const orphan = pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "orphan") });
    const keeper = pluginRecord({ pluginRoot: path.join(marketplaceRoot, "plugins", "keeper") });
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({
      ctx,
      pi,
      cwd,
      scope: "project",
      gitOps,
      hooksRouting,
      completionCache,
      uninstallPlugin,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" + "  ○ orphan v1.0.0 (uninstalled)\n" + "\n" + "Reconcile: 1 success",
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
      project.configJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ○ stray v1.0.0 (uninstalled)\n" +
          "  ○ victim v1.0.0 (uninstalled)\n" +
          "\n" +
          "Reconcile: 2 successes",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "stray@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ victim (failed) {unreadable}\n" +
          "    cause: cannot read the dependencies of stray@mp: not declared by its marketplace\n" +
          // `stray` itself is declared but its marketplace does not list it, so
          // its own re-resolution fails on the same unreadable manifest entry.
          "  ⊘ stray (failed) {unreadable}\n" +
          "\n" +
          "Reconcile: 2 failures",
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

  test("WR-06: a plugin whose declaration is deleted is uninstalled while its marketplace stays recorded, and the next pass is silent", async (t) => {
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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
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
      pi,
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
      pi,
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
        message: "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), []);
    assert.strictEqual(dataExistsAfterFirst, false);
    assert.deepStrictEqual(await loadState(project.extensionRoot), afterFirst);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
    await writeUnder(project.configJsonPath, declaration);
    const kept = pluginRecord({
      pluginRoot: path.join(marketplaceRoot, "plugins", "kept"),
      skills: ["kept-tool"],
    });
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcileWithRouting({
      ctx,
      pi,
      cwd,
      scope: "project",
      completionCache,
      gitOps,
      hooksRouting,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(
      Object.keys((await loadState(project.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
      ["kept"],
    );
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
        project.configJsonPath,
        configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
      );
      await seedState(project, {
        schemaVersion: 3,
        lastReconciledExtensionVersion: EXTENSION_VERSION,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n" +
            "\n" +
            "● mp [project]\n" +
            `${rows}\n` +
            "\n" +
            "Reconcile: 1 failure, 2 successes",
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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● mp [project]\n  ● hello (installed)\n\nReconcile: 1 success" },
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
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RESV-06: an install whose OWN manifest entry is missing classifies as before, not as a dependency failure", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-own-failure");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "ghost@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert: the dependency's own ledger error rides the row intact -- its
    // message AND its nested cause, both redacted -- instead of the single
    // truncated line RESV-06 used to leave behind.
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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● canonical-name [project]\n" +
          "  ● formatter (installed)\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces), ["canonical-name"]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["canonical-name"]!.plugins), [
      "formatter",
    ]);
    assert.deepStrictEqual(await loadState(project.extensionRoot), afterFirst);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
    await writeUnder(project.configJsonPath, declaration);
    const initialState = {
      schemaVersion: 3 as const,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "soft@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ● soft (installed) {malformed skill}\n" +
          "\n" +
          "Reconcile: 1 warning",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "orphan@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const ownerRuntime = createHooksRuntime();
    const peerRuntime = createHooksRuntime();
    const hooksRouting = createHooksRouting(ownerRuntime, { readHooksJson });

    // act
    await applyReconcileWithRouting({
      ctx,
      pi,
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      gitOps,
      hooksRouting,
    });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project]\n  ● orphan (installed) {orphan rewake}\n\nReconcile: 1 success",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "rich@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● rich (installed) {requires pi-subagents, requires pi-mcp}\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "rich"))?.resources.mcpServers, [
      "echo",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("S2: two agents with dropped mcpServers raise the plural post-install warning header", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-warnings");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      duo: { agents: ["with-mcp-servers", "with-mcp-servers"] },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "duo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● duo (installed) {requires pi-subagents}\n" +
          "\n" +
          "Reconcile: 1 success",
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

  test("DFEN-04: a bare declaration under an entry that defaults to disabled installs, unstages, names the cause and the remedy, and stamps the declaring base file", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-disabled-base");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      quiet: { entryDefaultEnabled: false, skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "quiet"))?.enabled, false);
    assert.deepStrictEqual(JSON.parse(await readFile(project.configJsonPath, "utf8")), {
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

  test("DFEN-05: the same declaration made only in the local file stamps the local file and leaves the base file byte-identical", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-disabled-local");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      quiet: { entryDefaultEnabled: false, skill: "clean" },
    });
    const baseDeclaration = configBytes({ marketplaces: { mp: { source: marketplaceRoot } } });
    await writeUnder(project.configJsonPath, baseDeclaration);
    await writeUnder(project.configLocalJsonPath, configBytes({ plugins: { "quiet@mp": {} } }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    assert.equal(await readFile(project.configJsonPath, "utf8"), baseDeclaration);
    assert.deepStrictEqual(JSON.parse(await readFile(project.configLocalJsonPath, "utf8")), {
      schemaVersion: 1,
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
      rows: "  ⊘ gone (failed) {no longer installable}\n  ● mike (installed)\n  ● alfa (installed)",
    },
    {
      name: "middle",
      keys: ["mike", "gone", "alfa"],
      rows: "  ● mike (installed)\n  ⊘ gone (failed) {no longer installable}\n  ● alfa (installed)",
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
        project.configJsonPath,
        configBytes({
          marketplaces: { mp: { source: marketplaceRoot } },
          plugins: Object.fromEntries(keys.map((key) => [`${key}@mp`, {}])),
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        lastReconciledExtensionVersion: EXTENSION_VERSION,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n" +
            "\n" +
            "● mp [project]\n" +
            `${rows}\n` +
            "\n" +
            "Reconcile: 1 failure, 2 successes",
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
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● mp [project]\n  ● hello v1.0.0 (installed)\n\nReconcile: 1 success" },
    ]);
    const record = await recordFor(project, "mp", "hello");
    assert.equal(record?.enabled, true);
    assert.equal(record?.version, "1.0.0");
    assert.deepStrictEqual(record?.resources.skills, ["hello-tool"]);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  const enableSignalRows = [
    {
      name: "declares both companions when the ledger stages an agent and a server",
      tree: { agents: ["with-tools"], mcpServer: true, skill: "clean" },
      row: "  ● hello v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}",
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
        project.configJsonPath,
        configBytes({
          marketplaces: { mp: { source: marketplaceRoot } },
          plugins: { "hello@mp": {} },
        }),
      );
      await seedState(project, {
        schemaVersion: 3,
        lastReconciledExtensionVersion: EXTENSION_VERSION,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `${summary}● mp [project]\n${row}\n\n${tally}`,
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "hello@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n  ◉ hello v1.0.0 (partially-installed) {lsp}\n\nReconcile: 1 success",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: vanished } },
        plugins: { "hello@mp": {} },
      }),
    );
    const seeded: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": { enabled: false }, "zulu@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
          "Reconcile: 1 failure, 1 success",
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
      project.configJsonPath,
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {source mismatch}\n" +
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
    await writeUnder(project.configJsonPath, projectConfig);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(user.configJsonPath, userConfig);
    await seedState(user, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(path.join(project.scopeRoot, "unrelated.txt"), "project bytes\n");
    await writeUnder(path.join(user.scopeRoot, "unrelated.txt"), "user bytes\n");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const startedAt = Date.now();

    // act
    await applyReconcile({ ctx, pi, cwd, gitOps });
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
          lastUpdatedAt: projectRecord.lastUpdatedAt,
        },
      },
    });
    assert.deepStrictEqual(userState, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
          lastUpdatedAt: userRecord.lastUpdatedAt,
        },
      },
    });
    assert.equal(await readFile(project.configJsonPath, "utf8"), projectConfig);
    assert.equal(await readFile(user.configJsonPath, "utf8"), userConfig);
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
      project.configJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/proj" } } }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(
      user.configJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/user" } } }),
    );
    await seedState(user, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/proj.git", "https://github.com/acme/user.git"],
      fixtureSourceDir: fixture.marketplaceRoot,
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);

    // act
    await applyReconcile({ ctx, pi, cwd, gitOps });

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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "hello@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project] (added)\n" + "  ● hello (installed)\n" + "\n" + "Reconcile: 2 successes",
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
      project.configJsonPath,
      configBytes({ marketplaces: { "p-mp": { source: projectSource.marketplaceRoot } } }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(
      user.configJsonPath,
      configBytes({ marketplaces: { "u-mp": { source: userSource.marketplaceRoot } } }),
    );
    const userState: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    };
    await seedState(user, userState);
    const userStateBytes = await readFile(user.stateJsonPath, "utf8");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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

  test("RECON-05: two consecutive reconciles over a converged scope stay silent and leave both files byte-identical and untouched", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "converged");
    const declaration = configBytes({ marketplaces: {}, plugins: {} });
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const configModifiedAt = (await stat(project.configJsonPath)).mtimeMs;
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(project.configJsonPath)).mtimeMs, configModifiedAt);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, stateModifiedAt);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("BFILL-01: one cascade carries a backfill promotion row beside a fresh install row and no reload trailer", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "promotion");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      fresh: { skill: "clean" },
      promoted: { command: true, skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "fresh@mp": {}, "promoted@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      // Older than the running version, so the backfill gate opens.
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● fresh (installed)\n" +
          // WCONV-03: the promotion row says why it appeared; the fresh install
          // beside it has no such brace, which is the whole point of the marker.
          "  ● promoted v1.0.0 (installed) {components now supported}\n" +
          "\n" +
          "Reconcile: 2 successes",
      },
    ]);
    assert.equal(
      (await loadState(project.extensionRoot)).lastReconciledExtensionVersion,
      EXTENSION_VERSION,
    );
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

  test("WR-05: a scope that declares a configuration but has never recorded state stays silent and gains no state file", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "config-only");
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {}, plugins: {} }));
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ◍ quiet v1.0.0 (disabled) {installs disabled}\n" +
          "    Run enable on this plugin to use its components.\n" +
          "\n" +
          "Reconcile: 1 success",
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
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({ ctx, pi, cwd, scope: "project", gitOps });

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
      project.configJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
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
      pi,
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
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(user.configJsonPath, configBytes({ marketplaces: {} }));
    const projectRecorded: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();

    // act
    await applyWithReader({ ctx, pi, cwd, completionCache, gitOps, hooksRouting });
    await applyWithReader({ ctx, pi, cwd, completionCache, gitOps, hooksRouting });

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
    assert.deepStrictEqual(readerRoots, [
      project.extensionRoot,
      user.extensionRoot,
      project.extensionRoot,
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
      project.configJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    const competingState: ExtensionState = {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithRace({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    const declaration = await readFile(project.configJsonPath, "utf8");
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u25cd deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, false);
    assert.equal(record?.dependencyDisabled, true);
    assert.equal(await pathExists(path.join(project.skillsTargetDir, "deploy-kit-tool")), false);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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

    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, stampDependencyDisabled });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "⊘ state.json [project] (failed) {lock held}\n" +
          "  ⊘ state.json (failed) {lock held}\n" +
          "    cause: Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.\n" +
          "\n" +
          "Reconcile: 2 failures, 1 warning",
        severity: "error",
      },
    ]);
    const record = await recordFor(project, "mp", "deploy-kit");
    assert.equal(record?.enabled, false);
    assert.equal(Object.hasOwn(record ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-01: a scope whose declarations are all satisfied stays silent and leaves state.json untouched", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-satisfied");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, stateModifiedAt);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-06-02: a record disabled before the pass is held down without being stamped or reported", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-already-disabled");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              pluginRoot: path.join(marketplaceRoot, "plugins", "secrets-vault"),
            }),
          },
        }),
      },
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
          "Reconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(record?.resources.skills, ["deploy-kit-tool"]);
    assert.equal(await pathExists(path.join(project.skillsTargetDir, "deploy-kit-tool")), true);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("LOAD-02: a second reload over an unchanged unsatisfied tree plans the retry bucket and stays silent", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-converges");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const first = createNotificationBoundary(1, 3);
    const second = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx: first.ctx, pi: first.pi, cwd, scope: "project", gitOps });
    const settledBytes = await readFile(project.stateJsonPath, "utf8");
    const settledModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const replanned = await replanFromDisk(project);
    await applyReconcile({ ctx: second.ctx, pi: second.pi, cwd, scope: "project", gitOps });

    // assert -- the plan is compared against the FACTORY, so a bucket added
    // later cannot slip past this case by being absent from a hand-written
    // literal. D-09-14: the dependency stays missing (mp never declared
    // secrets-vault), so the retry bucket re-plans the same entry every
    // pass -- a deliberate non-fixpoint. This reconcile never opted into
    // `reason: "reload"`, so the apply step drives nothing off it and the
    // second pass is still silent (the LOAD-02 silence contract holds at
    // startup, D-09-13).
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
    assert.deepStrictEqual(second.notifications, []);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, settledModifiedAt);
    assert.deepStrictEqual(clonedUrls(), []);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "bravo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert -- the exact set and the exact order, not "at least one row": the
    // fixpoint's sorted batch order puts bravo (held by the absent charlie)
    // before alfa (held by bravo), and an assertion that merely counted rows
    // would pass against an implementation that propagated nothing.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some plugin operations need attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ bravo v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "charlie@mp" or uninstall "bravo@mp"\n' +
          "  ◍ alfa v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Enable "bravo@mp" or uninstall "alfa@mp"\n' +
          "\n" +
          "Reconcile: 2 warnings",
        severity: "warning",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "bravo@mp": {}, "charlie@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const first = createNotificationBoundary(1, 3);
    const second = createNotificationBoundary(0, 0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx: first.ctx, pi: first.pi, cwd, scope: "project", gitOps });
    const settledBytes = await readFile(project.stateJsonPath, "utf8");
    await applyReconcile({ ctx: second.ctx, pi: second.pi, cwd, scope: "project", gitOps });

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
    assert.deepStrictEqual(second.notifications, []);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.deepStrictEqual(clonedUrls(), []);
    first.verifyBoundary();
    second.verifyBoundary();
  });

  test("D-05-07: a declarer whose own manifest cannot be read is reported and nothing in the scope is disabled", async (t) => {
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "alfa@mp": {}, "broken@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u2298 broken (failed) {unreadable}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.equal((await recordFor(project, "mp", "alfa"))?.enabled, true);
    assert.equal((await recordFor(project, "mp", "broken"))?.enabled, true);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "\u25cf mp [project]\n" +
          "  \u2298 deploy-kit (failed) {permission denied}\n" +
          "\n" +
          "Reconcile: 1 failure",
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
  // MISS-01 / MISS-02 / D-09-04 .. D-09-14: the reload-only dependency-install
  // step (`applyDependencyInstalls`) and its D-09-07 re-plan
  // (`refreshTogglePlan`). Every case here passes `reason: "reload"` unless
  // it is deliberately proving the startup/omitted posture.
  // ───────────────────────────────────────────────────────────────────────

  test("MISS-01: a reload installs a missing declared dependency and the dependent stays up", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-install");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    const declaration = await readFile(project.configJsonPath, "utf8");
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    const secretsVault = await recordFor(project, "mp", "secrets-vault");
    assert.equal(secretsVault?.provenance, "dependency");
    assert.equal(secretsVault?.enabled, true);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
    assert.equal(await pathExists(project.configLocalJsonPath), false);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

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
    assert.match(diagnostic?.message ?? "", /post-install warning/);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed, orphan rewake}\n" +
          "\n" +
          "Reconcile: 1 success",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed, dependency current copy}\n" +
          "\n" +
          "Reconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-13: a startup reconcile plans the bucket but installs nothing and stays offline", async (t) => {
    // arrange -- same fixture as the reload case above (secrets-vault is
    // genuinely installable), but the host says `startup`.
    const { cwd, project } = await createHermeticScopes(t, "dependency-startup-noop");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "startup" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-13: an omitted reason plans the bucket but installs nothing and stays offline", async (t) => {
    // arrange -- identical fixture; `reason` left out of the call entirely.
    const { cwd, project } = await createHermeticScopes(t, "dependency-omitted-reason-noop");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act -- `reason` omitted entirely.
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 warning",
        severity: "warning",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-07: a marker-held dependent comes back up in the same reload", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-lift");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert -- the install row first (step 5), then the record-walk lift
    // (step 5a's fresh pluginsToEnable).
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "  ● deploy-kit v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 2 successes",
      },
    ]);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.enabled, true);
    assert.equal(Object.hasOwn(deployKit ?? {}, "dependencyDisabled"), false);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-08: a provenance-independent dependent comes back up in the same reload", async (t) => {
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert -- both app and lib reach pluginsToEnable through the D-09-08
    // record-walk lift (the fresh verdict still holds app down too, since
    // lib's record is not yet flipped inside the same verdict snapshot), in
    // state.marketplaces iteration order: app was seeded before lib.
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● core v1.0.0 (installed) {dependency installed}\n" +
          "  ● app v1.0.0 (installed)\n" +
          "  ● lib v1.0.0 (installed)\n" +
          "\n" +
          "Reconcile: 3 successes",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n" +
          "\n" +
          "● mp [project]\n" +
          "  ⊘ secrets-vault (failed) {dependency failed}\n" +
          '    cause: Dependency "crypto-core@mp" is not declared by its marketplace.\n' +
          "  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}\n" +
          '    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"\n' +
          "\n" +
          "Reconcile: 1 failure, 1 warning",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.dependencyDisabled, true);
    const [notification] = notifications;
    assert.ok(!(notification?.message ?? "").includes("/"));
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

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

  test("MISS-02: a dependency its marketplace does not declare keeps its own ledger's token", async (t) => {
    // arrange -- reuses the LOAD-01 fixture's shape: deploy-kit declares
    // secrets-vault, and mp's manifest does not list it at all.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-not-in-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert -- the root's own ledger failure passes through unwrapped, no
    // cause line.
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
          "Reconcile: 1 failure, 1 warning",
        severity: "error",
      },
    ]);
    assert.equal(await recordFor(project, "mp", "secrets-vault"), undefined);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-09-14: a failed dependency install is retried on the next reload and the dependent's row is silent once down", async (t) => {
    // arrange -- the not-in-manifest fixture, reloaded twice.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-retry");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const first = createNotificationBoundary(1, 3);
    const second = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({
      ctx: first.ctx,
      pi: first.pi,
      cwd,
      scope: "project",
      gitOps,
      reason: "reload",
    });
    await applyReconcile({
      ctx: second.ctx,
      pi: second.pi,
      cwd,
      scope: "project",
      gitOps,
      reason: "reload",
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

  test("D-09-04: a disabled recorded dependency is left alone by the reload", async (t) => {
    // arrange -- secrets-vault is recorded and disabled by the USER (no
    // marker); deploy-kit is enabled.
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-disabled-left-alone");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": { enabled: false } },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

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
          "Reconcile: 1 warning",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "app@mp": {}, "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert -- app's own cascade row is the only row (the standard install
    // path carries no version for a config-declared install); helper is
    // materialized once, and deploy-kit is left untouched.
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project]\n" + "  ● app (installed)\n" + "\n" + "Reconcile: 1 success",
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

  test("D-09-07: a read pass that fails after an install keeps the round-1 toggles and reports state.json", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "dependency-reload-reread-fallback");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      "deploy-kit": { dependencies: ["secrets-vault"], skill: "clean" },
      "secrets-vault": { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    let calls = 0;
    const applyWithFailingReread = createApplyReconcile({
      async loadState(extensionRoot: string): Promise<ExtensionState> {
        if (extensionRoot === project.extensionRoot) {
          calls += 1;
          if (calls === 2) {
            throw new Error("second read failed");
          }
        }

        return loadState(extensionRoot);
      },
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyWithFailingReread({
      ctx,
      pi,
      cwd,
      scope: "project",
      gitOps,
      reason: "reload",
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    });

    // assert -- the install row still renders, plus a synthesized state.json
    // row for the failed re-read, and deploy-kit ends stamped down by
    // round-1's toggle plan (the refresh never applied).
    assert.equal(notifications.length, 1);
    const message = notifications[0]?.message ?? "";
    assert.ok(message.includes("secrets-vault v1.0.0 (installed) {dependency installed}"));
    assert.ok(message.includes("state.json (failed)"));
    const secretsVault = await recordFor(project, "mp", "secrets-vault");
    assert.equal(secretsVault?.provenance, "dependency");
    const deployKit = await recordFor(project, "mp", "deploy-kit");
    assert.equal(deployKit?.dependencyDisabled, true);
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "ghost@nowhere": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

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
    test(`XMKT-01 reload evaluates ${scenario.name}`, async (t) => {
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
        project.configJsonPath,
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
        lastReconciledExtensionVersion: EXTENSION_VERSION,
        marketplaces: {
          alpha: marketplaceRecord({
            cwd,
            scope: "project",
            marketplace: "alpha",
            rawSource: alpha.marketplaceRoot,
            manifestPath: alpha.manifestPath,
            marketplaceRoot: alpha.marketplaceRoot,
            plugins: {
              a: pluginRecord({ pluginRoot: path.join(alpha.marketplaceRoot, "plugins", "a") }),
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
                c: pluginRecord({ pluginRoot: path.join(beta.marketplaceRoot, "plugins", "c") }),
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
                c: pluginRecord({ pluginRoot: path.join(gamma.marketplaceRoot, "plugins", "c") }),
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
      const { gitOps, clonedUrls } = createOfflineGitOps();

      // act
      await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

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
              "Reconcile: 1 success",
          },
        ]);
      }

      assert.equal(await pathExists(user.stateJsonPath), false);
      assert.deepStrictEqual(clonedUrls(), []);
      verifyBoundary();
    });
  }

  test("XMKT-01 reload installs a user-sourced missing dependency into project scope", async (t) => {
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
      project.configJsonPath,
      configBytes({
        marketplaces: { alpha: { source: alpha.marketplaceRoot } },
        plugins: { "a@alpha": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {
        alpha: marketplaceRecord({
          cwd,
          scope: "project",
          marketplace: "alpha",
          rawSource: alpha.marketplaceRoot,
          manifestPath: alpha.manifestPath,
          marketplaceRoot: alpha.marketplaceRoot,
          plugins: {
            a: pluginRecord({ pluginRoot: path.join(alpha.marketplaceRoot, "plugins", "a") }),
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.equal((await recordFor(project, "beta", "b"))?.provenance, "dependency");
    assert.deepStrictEqual(await readFile(user.stateJsonPath), userBefore);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● beta [project]\n" +
          "  ● b v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success",
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
      project.configJsonPath,
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● tools [project]\n" +
          "  ● shared-lib v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "common@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
            common: pluginRecord({
              pluginRoot: path.join(marketplaceRoot, "plugins", "common"),
            }),
          },
        }),
      },
    });
    const before = await recordFor(project, "mp", "common");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 3);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps, reason: "reload" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● secrets-vault v1.0.0 (installed) {dependency installed}\n" +
          "\n" +
          "Reconcile: 1 success",
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
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "deploy-kit@mp": {}, "secrets-vault@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 3,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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

    const startup = createNotificationBoundary(0, 0);
    await withCounter(() => {
      startupCalls += 1;
    })({
      ctx: startup.ctx,
      pi: startup.pi,
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      gitOps: createOfflineGitOps().gitOps,
    });

    let reloadCalls = 0;
    const reload = createNotificationBoundary(0, 0);
    await withCounter(() => {
      reloadCalls += 1;
    })({
      ctx: reload.ctx,
      pi: reload.pi,
      cwd,
      scope: "project",
      completionCache: createCompletionCache(),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      gitOps: createOfflineGitOps().gitOps,
      reason: "reload",
    });

    // assert
    assert.deepStrictEqual(startup.notifications, []);
    assert.deepStrictEqual(reload.notifications, []);
    assert.equal(reloadCalls, startupCalls);
    assert.equal(await readFile(project.stateJsonPath, "utf8"), settledBytes);
    assert.equal((await stat(project.stateJsonPath)).mtimeMs, settledModifiedAt);
    startup.verifyBoundary();
    reload.verifyBoundary();
  });
});
