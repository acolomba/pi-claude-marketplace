// tests/integration/marketplace-layer-remove.test.ts
//
// Removing a marketplace from one config layer (LAYER-02, LAYER-03), across the
// remove orchestrator, both config files, the state file, the bridges' staged
// artifacts, and the git clone. A url-source marketplace is added through the
// git double cloning a local checkout, and its plugins install through the
// production install operation. The dependency cases (D-04-dep, PRUNE-03,
// D-05-07) read the scope's declarations through the real offline index.

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import lockfile from "proper-lockfile";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import { cascadeUnstagePlugin } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { planReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import {
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { mergeScopeConfigs } from "../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { StateLockHeldError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";

const REPO_URL = "https://example.com/acme/mp";

const ADDED = { message: "● mp [project] (added)" };

function installed(plugin: string): { readonly message: string } {
  return {
    message: `● mp [project]\n  ● ${plugin} v1.0.0 (installed)\n\n/reload to pick up changes`,
  };
}

interface ProjectScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly fixture: string;
}

/** A plugin a fixture marketplace offers, with the dependencies its own manifest declares. */
interface FixturePlugin {
  readonly name: string;
  readonly dependencies?: readonly string[];
}

/** One plugin of a fixture marketplace, with one skill. */
async function writeFixturePlugin(fixture: string, spec: FixturePlugin): Promise<void> {
  const plugin = spec.name;
  const pluginRoot = path.join(fixture, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "greet"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin, version: "1.0.0", dependencies: spec.dependencies ?? [] }),
  );
  await writeFile(
    path.join(pluginRoot, "skills", "greet", "SKILL.md"),
    `---\nname: greet\ndescription: greets from ${plugin}\n---\n\nHello from ${plugin}.\n`,
  );
}

/** Writes the marketplace `name` in `fixture`, offering `plugins`. */
async function writeFixtureMarketplace(
  fixture: string,
  name: string,
  plugins: readonly FixturePlugin[],
  allowed: readonly string[] = [],
): Promise<void> {
  await mkdir(path.join(fixture, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixture, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name,
      allowCrossMarketplaceDependenciesOn: allowed,
      plugins: plugins.map((plugin) => ({
        name: plugin.name,
        source: `./plugins/${plugin.name}`,
        version: "1.0.0",
      })),
    }),
  );
  await Promise.all(plugins.map((plugin) => writeFixturePlugin(fixture, plugin)));
}

/**
 * A project scope in a case-owned Pi environment, and a checkout offering
 * `plugins` (`alpha` and `beta` unless the case names others).
 */
async function projectScope(
  t: TestContext,
  prefix: string,
  plugins: readonly FixturePlugin[] = [{ name: "alpha" }, { name: "beta" }],
): Promise<ProjectScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const fixture = path.join(root, "checkout");
  await writeFixtureMarketplace(fixture, "mp", plugins);
  return { cwd, locations: locationsFor("project", cwd), fixture };
}

/** Declares `REPO_URL` in one layer through the add orchestrator and a git double. */
async function addRepo(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  local: boolean,
): Promise<void> {
  await addMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    rawSource: REPO_URL,
    gitOps: createGitOpsFake({
      boundary: "memory",
      allowedRemoteUrls: [REPO_URL],
      cloneFixture: { boundary: "local", sourceDir: scope.fixture },
    }).gitOps,
    credentialOps: createCredentialOpsFake({ boundary: "memory" }).credentialOps,
    local,
  });
}

/** Installs `plugin@marketplace` into the project scope, declaring it in the chosen layer. */
async function installFrom(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  plugin: string,
  local: boolean,
  marketplace = "mp",
): Promise<void> {
  const completionCache = createCompletionCache();
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );
  await installPlugin({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    marketplace,
    plugin,
    local,
  });
}

async function removeMp(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  cascade: typeof cascadeUnstagePlugin = cascadeUnstagePlugin,
): Promise<void> {
  await removeMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    name: "mp",
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    cascade,
  });
}

/** The entries of a directory, sorted; an absent directory has none. */
async function entriesOf(directory: string): Promise<readonly string[]> {
  return (await pathExists(directory)) ? (await readdir(directory)).sort() : [];
}

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? await readFile(filePath, "utf8") : undefined;
}

test("a shared-layer remove keeps the clone, the data directory, the local file, and the local plugin", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-");
  const boundary = createNotificationBoundary(5);
  await addRepo(scope, boundary, false);
  await addRepo(scope, boundary, true);
  await installFrom(scope, boundary, "alpha", false);
  await installFrom(scope, boundary, "beta", true);
  const marketplaceData = await scope.locations.marketplaceDataDir("mp");
  await mkdir(marketplaceData, { recursive: true });
  await writeFile(path.join(marketplaceData, "sentinel"), "marketplace data");
  const localBytes = await readFile(scope.locations.configLocalJsonPath, "utf8");
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  const cloneEntries = await entriesOf(cloneDir);

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    ADDED,
    installed("alpha"),
    installed("beta"),
    { message: "● mp [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes" },
  ]);
  assert.deepStrictEqual(await entriesOf(cloneDir), cloneEntries);
  assert.strictEqual(
    await readFile(path.join(marketplaceData, "sentinel"), "utf8"),
    "marketplace data",
  );
  assert.strictEqual(await readFile(scope.locations.configLocalJsonPath, "utf8"), localBytes);
  assert.deepStrictEqual(await entriesOf(scope.locations.skillsTargetDir), ["beta-greet"]);
  const state = await loadState(scope.locations.extensionRoot);
  assert.deepStrictEqual(Object.keys(state.marketplaces.mp?.plugins ?? {}), ["beta"]);
  boundary.verifyBoundary();
});

test("a named remove fully removes a recorded url marketplace no layer declares", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-undeclared-");
  const boundary = createNotificationBoundary(2);
  await addRepo(scope, boundary, false);
  await saveConfig(
    scope.locations.configJsonPath,
    { schemaVersion: 1, marketplaces: {} },
    scope.locations.scopeRoot,
  );
  const marketplaceData = await scope.locations.marketplaceDataDir("mp");
  await mkdir(marketplaceData, { recursive: true });
  const cloneDir = await scope.locations.sourceCloneDir("mp");

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [ADDED, { message: "● mp [project] (removed)" }]);
  assert.deepStrictEqual(
    [await pathExists(cloneDir), await pathExists(marketplaceData)],
    [false, false],
  );
  assert.deepStrictEqual(await loadState(scope.locations.extensionRoot), {
    schemaVersion: 3,
    marketplaces: {},
  });
  boundary.verifyBoundary();
});

test("a refused remove changes no state, config, clone, or staged artifact", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-refused-");
  const boundary = createNotificationBoundary(3);
  await addRepo(scope, boundary, true);
  await installFrom(scope, boundary, "beta", true);
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  const footprint = async (): Promise<readonly unknown[]> => [
    await readFile(scope.locations.stateJsonPath, "utf8"),
    await readIfPresent(scope.locations.configJsonPath),
    await readFile(scope.locations.configLocalJsonPath, "utf8"),
    await entriesOf(cloneDir),
    await entriesOf(scope.locations.skillsTargetDir),
  ];
  const footprintBefore = await footprint();

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    installed("beta"),
    {
      message:
        "Some operations have failed.\n\n⊘ mp [project] (failed)\n  ⊘ mp (failed) {marketplace declared locally}\n    cause: The marketplace mp is declared only in claude-plugins.local.json. Run the command again with --local.",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await footprint(), footprintBefore);
  boundary.verifyBoundary();
});

const ALPHA_NEEDS_LIB: readonly FixturePlugin[] = [
  { name: "alpha", dependencies: ["lib"] },
  { name: "lib" },
];

const ALPHA_WITH_LIB_INSTALLED = {
  message:
    "● mp [project]\n  ● alpha v1.0.0 (installed)\n  ● lib@mp v1.0.0 (installed)\n\n/reload to pick up changes",
};

/** The bytes and listings a refused or failed remove must leave as they were. */
async function removeFootprint(scope: ProjectScope): Promise<readonly unknown[]> {
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  return [
    await readFile(scope.locations.stateJsonPath, "utf8"),
    await readIfPresent(scope.locations.configJsonPath),
    await readIfPresent(scope.locations.configLocalJsonPath),
    await entriesOf(cloneDir),
    await readFile(path.join(cloneDir, ".claude-plugin", "marketplace.json"), "utf8"),
    await entriesOf(scope.locations.skillsTargetDir),
  ];
}

test("LAYER-02: a remove refused because the other config file is unreadable changes nothing", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-other-unreadable-");
  const boundary = createNotificationBoundary(4);
  await addRepo(scope, boundary, false);
  await addRepo(scope, boundary, true);
  await installFrom(scope, boundary, "alpha", false);
  await writeFile(scope.locations.configLocalJsonPath, "{ not json");
  const footprintBefore = await removeFootprint(scope);

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    ADDED,
    installed("alpha"),
    {
      message:
        'Some operations have failed.\n\n⊘ mp [project] (failed)\n  ⊘ mp (failed) {invalid manifest}\n    cause: Config file "claude-plugins.local.json" failed schema validation.',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await removeFootprint(scope), footprintBefore);
  boundary.verifyBoundary();
});

test("PRUNE-03: a dependency stays installed while the plugin that declares it fails to unstage", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-prune-", ALPHA_NEEDS_LIB);
  const boundary = createNotificationBoundary(3);
  await addRepo(scope, boundary, false);
  await installFrom(scope, boundary, "alpha", false);
  const before = await removeFootprint(scope);
  const failAlpha: typeof cascadeUnstagePlugin = (plugin, ...rest) =>
    plugin === "alpha"
      ? Promise.resolve({
          ok: false,
          dropped: {
            agents: [],
            commands: [],
            hooks: [],
            mcpServers: [],
            skills: [],
            workflows: [],
          },
          cause: Object.assign(new Error("alpha denied"), { code: "EACCES" }),
        })
      : cascadeUnstagePlugin(plugin, ...rest);

  // act
  await removeMp(scope, boundary, failAlpha);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    ALPHA_WITH_LIB_INSTALLED,
    {
      message:
        "Some operations have failed.\n\n⊘ mp [project] (failed)\n  ⊘ alpha (failed) {permission denied}\n    cause: alpha denied",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await removeFootprint(scope), before);
  boundary.verifyBoundary();
});

test("D-05-07: a remove whose dependency declarations cannot be read changes nothing", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-unreadable-", ALPHA_NEEDS_LIB);
  const boundary = createNotificationBoundary(3);
  await addRepo(scope, boundary, false);
  await installFrom(scope, boundary, "alpha", false);
  await writeFile(
    path.join(await scope.locations.sourceCloneDir("mp"), ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "mp", plugins: "nope" }),
  );
  const before = await removeFootprint(scope);

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    ALPHA_WITH_LIB_INSTALLED,
    {
      message:
        "Some operations have failed.\n\n⊘ mp [project] (failed)\n  ⊘ mp (failed) {unreadable}\n    cause: cannot read the dependencies of lib@mp: marketplace.json schema invalid: /plugins: must be array",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await removeFootprint(scope), before);
  boundary.verifyBoundary();
});

test("D-04-dep: a full remove that keeps a dependency keeps the url marketplace's record, data, and clone, and converges", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-kept-", ALPHA_NEEDS_LIB);
  const upstream = path.join(path.dirname(scope.fixture), "up");
  await writeFixtureMarketplace(
    upstream,
    "up",
    [{ name: "app", dependencies: ["lib@mp"] }],
    ["mp"],
  );
  const boundary = createNotificationBoundary(5);
  await addRepo(scope, boundary, false);
  await addMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    rawSource: upstream,
  });
  await installFrom(scope, boundary, "alpha", false);
  await installFrom(scope, boundary, "app", false, "up");
  const marketplaceData = await scope.locations.marketplaceDataDir("mp");
  await mkdir(marketplaceData, { recursive: true });
  await writeFile(path.join(marketplaceData, "sentinel"), "marketplace data");
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  const cloneEntries = await entriesOf(cloneDir);

  // act
  await removeMp(scope, boundary);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    ADDED,
    { message: "● up [project] (added)" },
    ALPHA_WITH_LIB_INSTALLED,
    {
      message:
        "● up [project]\n  ● app v1.0.0 (installed)\n  ⊘ lib@mp v1.0.0 (skipped) {already installed}\n\n/reload to pick up changes",
    },
    { message: "● mp [project] (removed)\n  ○ alpha (uninstalled)\n\n/reload to pick up changes" },
  ]);
  assert.deepStrictEqual(await entriesOf(cloneDir), cloneEntries);
  assert.strictEqual(
    await readFile(path.join(marketplaceData, "sentinel"), "utf8"),
    "marketplace data",
  );
  const state = await loadState(scope.locations.extensionRoot);
  assert.deepStrictEqual(
    Object.entries(state.marketplaces).map(([name, record]) => [name, Object.keys(record.plugins)]),
    [
      ["mp", ["lib"]],
      ["up", ["app"]],
    ],
  );
  const shared = await loadConfig(scope.locations.configJsonPath);
  assert.ok(shared.status === "valid");
  assert.deepStrictEqual(
    planReconcile(mergeScopeConfigs(shared.config, {}), state, "project"),
    emptyReconcilePlan("project"),
  );
  boundary.verifyBoundary();
});

test("a remove while another holder has the scope's state lock rejects and changes nothing", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-locked-");
  const boundary = createNotificationBoundary(2);
  await addRepo(scope, boundary, false);
  await installFrom(scope, boundary, "alpha", false);
  const before = await removeFootprint(scope);
  const release = await lockfile.lock(scope.locations.extensionRoot, {
    lockfilePath: scope.locations.stateLockFile,
    realpath: false,
  });
  t.after(async () => {
    await release();
  });

  // act
  const removal = removeMp(scope, boundary);

  // assert
  await assert.rejects(removal, StateLockHeldError);
  assert.deepStrictEqual(await removeFootprint(scope), before);
  assert.deepStrictEqual(boundary.notifications, [ADDED, installed("alpha")]);
  boundary.verifyBoundary();
});
