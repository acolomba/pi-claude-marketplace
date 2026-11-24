// test/integration/marketplace-layer-remove.test.ts
//
// Three internal cases (ITSCOPE-01) of fault injection. Removing a marketplace
// while a plugin fails to unstage (MR-7, PRUNE-03), across the remove
// orchestrator, both config files, the state file, the bridges' staged
// artifacts, and the git clone. The remove's `cascade` seam injects an EACCES
// unstage failure, which the cucumber harness cannot do: a partial remove, a
// remove in which every plugin fails, and a dependency that stays installed
// while the plugin that declares it fails to unstage. A url-source marketplace
// is added through the git double cloning a local checkout, and its plugins
// install through the production install operation. What a user sees of a
// remove is in `features/marketplace/remove.feature`.

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
import { cascadeUnstagePlugin } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import {
  createMachineNotificationBoundary,
  createNotificationBoundary,
} from "../edge/notification-boundary.ts";
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
): Promise<void> {
  await mkdir(path.join(fixture, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixture, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name,
      allowCrossMarketplaceDependenciesOn: [],
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
    await readIfPresent(scope.locations.baseConfigJsonPath),
    await readIfPresent(scope.locations.localConfigJsonPath),
    await entriesOf(cloneDir),
    await readFile(path.join(cloneDir, ".claude-plugin", "marketplace.json"), "utf8"),
    await entriesOf(scope.locations.skillsTargetDir),
  ];
}

test("a partial remove persists successes and reports every failure in order", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-partial-", [
    { name: "zebra" },
    { name: "yak" },
    { name: "amber" },
    { name: "birch" },
  ]);
  const setupBoundary = createNotificationBoundary(5);
  await addRepo(scope, setupBoundary, false);
  await installFrom(scope, setupBoundary, "zebra", false);
  await installFrom(scope, setupBoundary, "yak", false);
  await installFrom(scope, setupBoundary, "amber", false);
  await installFrom(scope, setupBoundary, "birch", false);
  const marketplaceData = await scope.locations.marketplaceDataDir("mp");
  const marketplaceDataSentinel = path.join(marketplaceData, "sentinel");
  await mkdir(marketplaceData, { recursive: true });
  await writeFile(marketplaceDataSentinel, "marketplace data");
  const setupState = await loadState(scope.locations.extensionRoot);
  const marketplaceBefore = setupState.marketplaces.mp;
  assert.ok(marketplaceBefore !== undefined);
  const yakBefore = marketplaceBefore.plugins.yak;
  const birchBefore = marketplaceBefore.plugins.birch;
  assert.ok(yakBefore !== undefined);
  assert.ok(birchBefore !== undefined);
  const baseConfigBefore = await readIfPresent(scope.locations.baseConfigJsonPath);
  const localConfigBefore = await readIfPresent(scope.locations.localConfigJsonPath);
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  const cloneEntriesBefore = await entriesOf(cloneDir);
  const marketplaceManifest = path.join(cloneDir, ".claude-plugin", "marketplace.json");
  const marketplaceManifestBefore = await readFile(marketplaceManifest, "utf8");
  const marketplaceDataBefore = await readFile(marketplaceDataSentinel, "utf8");
  const yakSkill = path.join(scope.locations.skillsTargetDir, "yak-greet", "SKILL.md");
  const birchSkill = path.join(scope.locations.skillsTargetDir, "birch-greet", "SKILL.md");
  const yakSkillBefore = await readFile(yakSkill, "utf8");
  const birchSkillBefore = await readFile(birchSkill, "utf8");
  const cascade: typeof cascadeUnstagePlugin = (plugin, ...rest) => {
    if (plugin === "yak" || plugin === "birch") {
      return Promise.resolve({
        ok: false,
        dropped: {
          agents: [],
          commands: [],
          hooks: [],
          mcpServers: [],
          skills: [],
          workflows: [],
        },
        cause: Object.assign(new Error(`${plugin} denied`), { code: "EACCES" }),
      });
    }

    return cascadeUnstagePlugin(plugin, ...rest);
  };

  const machineBoundary = createMachineNotificationBoundary("json");

  // act
  await removeMarketplace({
    ctx: machineBoundary.ctx,
    run: machineBoundary.run,
    name: "mp",
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    cascade,
  });

  // assert
  assert.deepStrictEqual(machineBoundary.capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "cascade",
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        severity: "error",
        needsReload: true,
        summary: "Some operations have failed.",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            plugins: [
              {
                status: "uninstalled",
                name: "zebra",
                id: "zebra@mp",
                reasons: [],
                scope: "project",
              },
              {
                status: "uninstalled",
                name: "amber",
                id: "amber@mp",
                reasons: [],
                scope: "project",
              },
              {
                status: "failed",
                name: "yak",
                id: "yak@mp",
                reasons: ["permission denied"],
                scope: "project",
                cause: { causeChain: ["yak denied"], truncated: false },
                leaks: [],
                rollbackPartial: [],
              },
              {
                status: "failed",
                name: "birch",
                id: "birch@mp",
                reasons: ["permission denied"],
                scope: "project",
                cause: { causeChain: ["birch denied"], truncated: false },
                leaks: [],
                rollbackPartial: [],
              },
            ],
          },
        ],
      },
    },
  ]);
  assert.deepStrictEqual(await loadState(scope.locations.extensionRoot), {
    ...setupState,
    marketplaces: {
      ...setupState.marketplaces,
      mp: {
        ...marketplaceBefore,
        plugins: { yak: yakBefore, birch: birchBefore },
      },
    },
  });
  assert.strictEqual(await readIfPresent(scope.locations.baseConfigJsonPath), baseConfigBefore);
  assert.strictEqual(await readIfPresent(scope.locations.localConfigJsonPath), localConfigBefore);
  assert.deepStrictEqual(await entriesOf(cloneDir), cloneEntriesBefore);
  assert.strictEqual(await readFile(marketplaceManifest, "utf8"), marketplaceManifestBefore);
  assert.strictEqual(await readFile(marketplaceDataSentinel, "utf8"), marketplaceDataBefore);
  assert.deepStrictEqual(await entriesOf(scope.locations.skillsTargetDir), [
    "birch-greet",
    "yak-greet",
  ]);
  assert.strictEqual(await readFile(yakSkill, "utf8"), yakSkillBefore);
  assert.strictEqual(await readFile(birchSkill, "utf8"), birchSkillBefore);
  assert.deepStrictEqual(setupBoundary.notifications, [
    ADDED,
    installed("zebra"),
    installed("yak"),
    installed("amber"),
    installed("birch"),
  ]);
  machineBoundary.capture.assertValid();
  setupBoundary.verifyBoundary();
  machineBoundary.verifyBoundary();
});

test("a failure-only remove keeps every plugin and needs no reload", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-remove-failure-only-", [
    { name: "yak" },
    { name: "birch" },
  ]);
  const setupBoundary = createNotificationBoundary(3);
  await addRepo(scope, setupBoundary, false);
  await installFrom(scope, setupBoundary, "yak", false);
  await installFrom(scope, setupBoundary, "birch", false);
  const marketplaceData = await scope.locations.marketplaceDataDir("mp");
  const marketplaceDataSentinel = path.join(marketplaceData, "sentinel");
  await mkdir(marketplaceData, { recursive: true });
  await writeFile(marketplaceDataSentinel, "marketplace data");
  const footprintBefore = await removeFootprint(scope);
  const marketplaceDataBefore = await readFile(marketplaceDataSentinel, "utf8");
  const yakSkill = path.join(scope.locations.skillsTargetDir, "yak-greet", "SKILL.md");
  const birchSkill = path.join(scope.locations.skillsTargetDir, "birch-greet", "SKILL.md");
  const yakSkillBefore = await readFile(yakSkill, "utf8");
  const birchSkillBefore = await readFile(birchSkill, "utf8");
  const cascade: typeof cascadeUnstagePlugin = (plugin) =>
    Promise.resolve({
      ok: false,
      dropped: {
        agents: [],
        commands: [],
        hooks: [],
        mcpServers: [],
        skills: [],
        workflows: [],
      },
      cause: Object.assign(new Error(`${plugin} denied`), { code: "EACCES" }),
    });

  const machineBoundary = createMachineNotificationBoundary("json");

  // act
  await removeMarketplace({
    ctx: machineBoundary.ctx,
    run: machineBoundary.run,
    name: "mp",
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    cascade,
  });

  // assert
  assert.deepStrictEqual(machineBoundary.capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "cascade",
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        severity: "error",
        needsReload: false,
        summary: "Some operations have failed.",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            status: "failed",
            plugins: [
              {
                status: "failed",
                name: "yak",
                id: "yak@mp",
                reasons: ["permission denied"],
                scope: "project",
                cause: { causeChain: ["yak denied"], truncated: false },
                leaks: [],
                rollbackPartial: [],
              },
              {
                status: "failed",
                name: "birch",
                id: "birch@mp",
                reasons: ["permission denied"],
                scope: "project",
                cause: { causeChain: ["birch denied"], truncated: false },
                leaks: [],
                rollbackPartial: [],
              },
            ],
          },
        ],
      },
    },
  ]);
  assert.deepStrictEqual(await removeFootprint(scope), footprintBefore);
  assert.strictEqual(await readFile(marketplaceDataSentinel, "utf8"), marketplaceDataBefore);
  assert.strictEqual(await readFile(yakSkill, "utf8"), yakSkillBefore);
  assert.strictEqual(await readFile(birchSkill, "utf8"), birchSkillBefore);
  assert.deepStrictEqual(setupBoundary.notifications, [
    ADDED,
    installed("yak"),
    installed("birch"),
  ]);
  machineBoundary.capture.assertValid();
  setupBoundary.verifyBoundary();
  machineBoundary.verifyBoundary();
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
