// Owner suite for orchestrators/reconcile/apply.ts.
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
//   plugin-install-failed    a manifest entry whose source tree is gone
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
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  applyReconcile,
  surfacePostCommitWarnings,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

const RECORDED_AT = "2026-01-01T00:00:00.000Z";

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface Notification {
  readonly message: string;
  readonly severity?: NotificationSeverity;
}

interface NotificationBoundary {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly notifications: readonly Notification[];
  readonly verifyBoundary: () => void;
}

/**
 * The Pi boundary, sized to the emissions the case promises. The applied
 * cascade takes one soft-dependency probe per emission and that probe reads
 * `pi.getAllTools()` twice; the post-cascade diagnostic channel reads neither,
 * so `toolProbes` is stated separately from `emissions`. An emission beyond the
 * promised count throws at the call site rather than being counted afterwards.
 */
function createNotificationBoundary(
  emissions: number,
  toolProbes = emissions * 2,
): NotificationBoundary {
  const notifications: Notification[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(emissions);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(toolProbes);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(emissions);

  return {
    ctx,
    pi,
    notifications,
    verifyBoundary: (): void => {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
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
  const cwd = await mkdtemp(path.join(tmpdir(), `apply-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `apply-${label}-home-`));
  const denied: string[] = [];
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    for (const directory of denied) {
      await chmod(directory, 0o755);
    }

    await rm(cwd, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 });
    await rm(home, { force: true, maxRetries: 10, recursive: true, retryDelay: 100 });
  });
  process.env.HOME = home;
  // SC-1: getAgentDir() reads PI_CODING_AGENT_DIR before homedir(), so an
  // environment that sets it would defeat the hermetic HOME above.
  delete process.env.PI_CODING_AGENT_DIR;
  return {
    cwd,
    home,
    project: locationsFor("project", cwd),
    user: locationsFor("user", cwd),
    denyWrites: async (directory: string): Promise<void> => {
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
   * One entry per agent file. `with-tools` declares a `tools:` list, which is
   * what keeps the bridge from raising its defaulted-tools post-commit warning;
   * `without-tools` raises exactly one such warning per file.
   */
  readonly agents?: readonly ("with-tools" | "without-tools")[];
  readonly mcpServer?: boolean;
  readonly hooks?: boolean;
  /** hooks.json whose kept handler carries a rewake field without `asyncRewake: true`. */
  readonly orphanRewakeHooks?: boolean;
  /** `.lsp.json` convention file -- a component kind the resolver cannot support. */
  readonly lsp?: boolean;
  /** DFEN-04: stamp `defaultEnabled` on the plugin's MARKETPLACE ENTRY. */
  readonly entryDefaultEnabled?: boolean;
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
    JSON.stringify({ name: plugin, version: "1.0.0" }),
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
        (tools === "with-tools" ? "tools: Read, Bash, Edit\n" : "") +
        "---\n\nbody\n",
    );
  }

  if (tree.mcpServer === true) {
    await writeUnder(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { echo: { command: "echo", args: ["hi"] } } }),
    );
  }

  if (tree.hooks === true || tree.orphanRewakeHooks === true) {
    await writeUnder(
      path.join(pluginRoot, "hooks", "hooks.json"),
      JSON.stringify({
        PreToolUse: [
          {
            matcher: "",
            hooks: [
              tree.orphanRewakeHooks === true
                ? { type: "command", command: "echo orphan", rewakeMessage: "wake me" }
                : { type: "command", command: "echo hi" },
            ],
          },
        ],
      }),
    );
  }

  if (tree.lsp === true) {
    await writeUnder(
      path.join(pluginRoot, ".lsp.json"),
      JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
    );
  }
}

/** Lay down the plugin trees and the marketplace manifest that declares them. */
async function writeMarketplaceSource(
  parentDir: string,
  directory: string,
  marketplace: string,
  trees: Readonly<Record<string, PluginTree>>,
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
      plugins: Object.entries(trees).map(([plugin, tree]) => ({
        name: plugin,
        version: "1.0.0",
        source: `./plugins/${plugin}`,
        ...(tree.entryDefaultEnabled !== undefined && {
          defaultEnabled: tree.entryDefaultEnabled,
        }),
      })),
    }),
  );
  return { marketplaceRoot, manifestPath };
}

interface RecordSeed {
  readonly pluginRoot: string;
  readonly enabled?: boolean;
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
    },
    enabled: seed.enabled ?? true,
    installedAt: RECORDED_AT,
    updatedAt: RECORDED_AT,
  };
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

/** Read one plugin record back through the persistence loader. */
async function recordFor(
  locations: ScopedLocations,
  marketplace: string,
  plugin: string,
): Promise<PluginRecord | undefined> {
  return (await loadState(locations.extensionRoot)).marketplaces[marketplace]?.plugins[plugin];
}

/**
 * Answer `state.json` reads for one scope with `competing` from the
 * `fromRead`-th read onward. That is what another process winning the race
 * between the planner's read and an orchestrator's own locked re-read leaves
 * behind, and it is the only condition the converge and not-added arms
 * document. The double sits at the filesystem boundary the persistence layer
 * reads through; nothing inside the cascade is replaced, and the read count is
 * stated per case so a change in the read order fails the case rather than
 * silently passing it.
 */
function raceStateFromRead(
  t: TestContext,
  locations: ScopedLocations,
  fromRead: number,
  competing: ExtensionState | string,
): void {
  const fsModule = createRequire(import.meta.url)(
    "node:fs/promises",
  ) as typeof import("node:fs/promises");
  const readOriginal = fsModule.readFile.bind(fsModule);
  let reads = 0;
  const mocked = t.mock.method(
    fsModule,
    "readFile",
    async (...args: Parameters<typeof fsModule.readFile>) => {
      const [target] = args;
      if (typeof target === "string" && target === locations.stateJsonPath) {
        reads += 1;
        if (reads >= fromRead) {
          return typeof competing === "string" ? competing : JSON.stringify(competing);
        }
      }

      return readOriginal(...args);
    },
  );
  syncBuiltinESMExports();
  t.after(() => {
    mocked.mock.restore();
    syncBuiltinESMExports();
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

describe("applyReconcile", () => {
  test("WR-05: leaves a scope with neither a state file nor a configuration file untouched and silent", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "pristine");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    };
    await seedState(project, seeded);
    await writeUnder(project.configJsonPath, "{");
    await writeUnder(project.configLocalJsonPath, JSON.stringify({ schemaVersion: 1, plugins: 7 }));
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    await writeUnder(project.configLocalJsonPath, JSON.stringify({ schemaVersion: 1, plugins: 7 }));
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
        schemaVersion: 2,
        lastReconciledExtensionVersion: EXTENSION_VERSION,
        marketplaces: {},
      });
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const unreachable = new Error("connect ENETUNREACH");
    (unreachable as { code?: string }).code = "ENETUNREACH";
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/remote.git"],
      cloneError: unreachable,
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);

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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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

  test("WR-06: a plugin whose declaration is deleted is uninstalled while its marketplace stays recorded, and the next pass is silent", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-direct");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const declaration = configBytes({
      marketplaces: { mp: { source: marketplaceRoot } },
      plugins: {},
    });
    await writeUnder(project.configJsonPath, declaration);
    await seedState(project, {
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });
    const afterFirst = await loadState(project.extensionRoot);
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project]\n  ○ hello v1.0.0 (uninstalled)\n\nReconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual(Object.keys(afterFirst.marketplaces["mp"]?.plugins ?? {}), []);
    assert.deepStrictEqual(await loadState(project.extensionRoot), afterFirst);
    assert.equal(await readFile(project.configJsonPath, "utf8"), declaration);
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
        schemaVersion: 2,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 2);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project]\n  ● orphan (installed) {orphan rewake}\n\nReconcile: 1 success",
      },
    ]);
    assert.deepStrictEqual((await recordFor(project, "mp", "orphan"))?.resources.hooks, ["orphan"]);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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

  test("S2: two agents installed without a declared tool list raise the plural post-install warning header", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "install-warnings");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      duo: { agents: ["without-tools", "without-tools"] },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "duo@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 2);
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
          "[bot0] source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.\n" +
          "[bot1] source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
        schemaVersion: 2,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
        schemaVersion: 2,
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
      const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
    await writeUnder(
      project.configJsonPath,
      configBytes({ marketplaces: { "p-mp": { source: projectSource.marketplaceRoot } } }),
    );
    await seedState(project, {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(
      user.configJsonPath,
      configBytes({ marketplaces: { "u-mp": { source: userSource.marketplaceRoot } } }),
    );
    await seedState(user, {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● p-mp [project] (added)\n\n● u-mp [user] (added)\n\nReconcile: 2 successes",
      },
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(project.extensionRoot)).marketplaces), [
      "p-mp",
    ]);
    assert.deepStrictEqual(Object.keys((await loadState(user.extensionRoot)).marketplaces), [
      "u-mp",
    ]);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(
      user.configJsonPath,
      configBytes({ marketplaces: { "remote-mp": { source: "acme/user" } } }),
    );
    await seedState(user, {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const { gitOps, clonedUrls } = createRemoteGitOps({
      allowedRemoteUrls: ["https://github.com/acme/proj.git", "https://github.com/acme/user.git"],
      fixtureSourceDir: fixture.marketplaceRoot,
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);

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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    await writeUnder(
      user.configJsonPath,
      configBytes({ marketplaces: { "u-mp": { source: userSource.marketplaceRoot } } }),
    );
    const userState: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    };
    await seedState(user, userState);
    const userStateBytes = await readFile(user.stateJsonPath, "utf8");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
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
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    const stateBytes = await readFile(project.stateJsonPath, "utf8");
    const configModifiedAt = (await stat(project.configJsonPath)).mtimeMs;
    const stateModifiedAt = (await stat(project.stateJsonPath)).mtimeMs;
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0);
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
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [project]\n" +
          "  ● fresh (installed)\n" +
          "  ● promoted v1.0.0 (installed)\n" +
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0);
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
      quiet: { agents: ["without-tools"], entryDefaultEnabled: false, skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({
        marketplaces: { mp: { source: marketplaceRoot } },
        plugins: { "quiet@mp": {} },
      }),
    );
    await seedState(project, {
      schemaVersion: 2,
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
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 2);
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
          "[bot0] source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
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
      schemaVersion: 2,
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
    // Reads in order: the planner's locked read, then the removal's own scope
    // resolution, which runs before the removal takes its lock and therefore
    // outside its own failure handling.
    raceStateFromRead(t, project, 2, "{ half written");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
      schemaVersion: 2,
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
    // Reads in order: the planner's locked read, then the uninstall's own
    // cross-scope target resolution, which runs before the uninstall takes its
    // lock and therefore outside its own failure handling.
    raceStateFromRead(t, project, 2, "{ half written");
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

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
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-06: a plugin another process uninstalled first renders no row at all", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "uninstall-converged");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeUnder(
      project.configJsonPath,
      configBytes({ marketplaces: { mp: { source: marketplaceRoot } }, plugins: {} }),
    );
    const recorded: ExtensionState = {
      schemaVersion: 2,
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
    };
    await seedState(project, recorded);
    const competitorLeft: ExtensionState = {
      ...recorded,
      marketplaces: {
        mp: { ...recorded.marketplaces["mp"]!, plugins: {} },
      },
    };
    // Reads in order: the planner's locked read, the uninstall resolver's
    // unlocked read, then the uninstall transaction's locked re-read. Only the
    // third sees the competitor's result.
    raceStateFromRead(t, project, 3, competitorLeft);
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-02: a marketplace another process removed first renders a not-added failure rather than a removal", async (t) => {
    // arrange
    const { cwd, project } = await createHermeticScopes(t, "remove-converged");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    await writeUnder(project.configJsonPath, configBytes({ marketplaces: {} }));
    const recorded: ExtensionState = {
      schemaVersion: 2,
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
    await seedState(project, recorded);
    // Reads in order: the planner's locked read, then the removal's own scope
    // resolution. Only the second sees the competitor's result.
    raceStateFromRead(t, project, 2, { ...recorded, marketplaces: {} });
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1);
    const { gitOps, clonedUrls } = createOfflineGitOps();

    // act
    await applyReconcile({ ctx, pi, cwd, scope: "project", gitOps });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n" +
          "\n" +
          "⊘ mp [project] (failed) {not found}\n" +
          "\n" +
          "Reconcile: 1 failure",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
});

describe("surfacePostCommitWarnings", () => {
  /** The options bundle the cascade hands the diagnostic channel. */
  function diagnosticOptions(ctx: ExtensionContext, pi: ExtensionAPI, gitOps: GitOps) {
    return { ctx, cwd: "/work/project", gitOps, pi, scope: "project" as const };
  }

  test("IL-2: says nothing when no outcome carries a post-commit warning", () => {
    // arrange
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0);
    const { gitOps } = createOfflineGitOps();
    const outcomes: readonly PerEntryOutcome[] = [
      {
        dependencies: [],
        kind: "plugin-installed",
        marketplace: "mp",
        plugin: "hello",
        scope: "project",
      },
      { kind: "plugin-uninstalled", marketplace: "mp", plugin: "gone", scope: "project" },
      { kind: "plugin-disabled", marketplace: "mp", plugin: "quiet", scope: "project" },
    ];

    // act
    surfacePostCommitWarnings(diagnosticOptions(ctx, pi, gitOps), outcomes);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("S2: reports a single warning under the singular header", () => {
    // arrange
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const { gitOps } = createOfflineGitOps();
    const outcomes: readonly PerEntryOutcome[] = [
      {
        dependencies: [],
        kind: "plugin-installed",
        marketplace: "mp",
        plugin: "hello",
        postCommitWarnings: ["data dir creation deferred"],
        scope: "project",
      },
    ];

    // act
    surfacePostCommitWarnings(diagnosticOptions(ctx, pi, gitOps), outcomes);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "1 post-install warning surfaced from reconcile installs.\n\ndata dir creation deferred",
        severity: "warning",
      },
    ]);
    verifyBoundary();
  });

  test("S2 / NFR-9: collects warnings from an installed row and a disabled row under the plural header and reduces every absolute path to its basename", () => {
    // arrange
    const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const { gitOps } = createOfflineGitOps();
    const outcomes: readonly PerEntryOutcome[] = [
      {
        dependencies: [],
        kind: "plugin-installed",
        marketplace: "mp",
        plugin: "hello",
        postCommitWarnings: [
          "hello/bad-skill: could not parse frontmatter of /home/user/plugins/hello/skills/bad/SKILL.md",
        ],
        scope: "project",
      },
      { kind: "mp-added", marketplace: "other", scope: "user" },
      {
        kind: "plugin-disabled",
        marketplace: "mp",
        plugin: "quiet",
        postCommitWarnings: ["quiet: preserved foreign agent at /home/user/agents/quiet-bot.md"],
        scope: "project",
      },
    ];

    // act
    surfacePostCommitWarnings(diagnosticOptions(ctx, pi, gitOps), outcomes);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          "2 post-install warnings surfaced from reconcile installs.\n" +
          "\n" +
          "hello/bad-skill: could not parse frontmatter of SKILL.md\n" +
          "quiet: preserved foreign agent at quiet-bot.md",
        severity: "warning",
      },
    ]);
    verifyBoundary();
  });
});
