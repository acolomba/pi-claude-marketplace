// tests/integration/marketplace-layer-remove.test.ts
//
// Removing a marketplace from one config layer (LAYER-02, LAYER-03), across the
// remove orchestrator, both config files, the state file, the bridges' staged
// artifacts, and the git clone. A url-source marketplace is added through the
// git double cloning a local checkout, and its plugins install through the
// production install operation.

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { saveConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
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

/** One plugin of the checkout, with one skill. */
async function writeFixturePlugin(fixture: string, plugin: string): Promise<void> {
  const pluginRoot = path.join(fixture, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "greet"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin, version: "1.0.0" }),
  );
  await writeFile(
    path.join(pluginRoot, "skills", "greet", "SKILL.md"),
    `---\nname: greet\ndescription: greets from ${plugin}\n---\n\nHello from ${plugin}.\n`,
  );
}

/** A project scope in a case-owned Pi environment, and a checkout offering `alpha` and `beta`. */
async function projectScope(t: TestContext, prefix: string): Promise<ProjectScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const fixture = path.join(root, "checkout");
  await mkdir(path.join(fixture, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixture, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "alpha", source: "./plugins/alpha", version: "1.0.0" },
        { name: "beta", source: "./plugins/beta", version: "1.0.0" },
      ],
    }),
  );
  await Promise.all(["alpha", "beta"].map((plugin) => writeFixturePlugin(fixture, plugin)));
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

/** Installs `plugin@mp` into the project scope, declaring it in the chosen layer. */
async function installFrom(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  plugin: string,
  local: boolean,
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
    marketplace: "mp",
    plugin,
    local,
  });
}

async function removeMp(scope: ProjectScope, boundary: NotificationBoundary): Promise<void> {
  await removeMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    name: "mp",
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
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
