// test/integration/project-install-adds-user-marketplace.test.ts
//
// A project install adds a user-scope marketplace to the project through the
// `marketplace add` code, so each scope owns its record and its clone
// (LAYER-07, D-MF-04). Real orchestrators drive a real local git checkout, and
// a git double stands in for the network: the install's add seam runs the real
// add body and settle with the double passed in.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import * as git from "isomorphic-git";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  addMarketplace,
  addMarketplaceToState,
  settleAddedMarketplace,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import { updateMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { listPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts";
import {
  createInstallOperation,
  getPluginInfo,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { noStatusSnapshot } from "../platform/mcp-status-seed.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ListRemotesResult } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";
import type { GitOpsFake } from "../platform/git-ops-fake.ts";

const REPO_URL = "https://example.com/acme/mp";
const TOOLS_URL = "https://example.com/acme/tools";
// The fake's default remote head; a fetch does not derive `origin/HEAD`.
const REMOTE_HEAD = "0000000000000000000000000000000000000002";

interface FixturePlugin {
  readonly name: string;
  readonly dependencies?: readonly string[];
}

interface Scopes {
  readonly cwd: string;
  readonly root: string;
  readonly user: ScopedLocations;
  readonly project: ScopedLocations;
}

async function scopes(t: TestContext, prefix: string): Promise<Scopes> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  return { cwd, root, user: locationsFor("user", cwd), project: locationsFor("project", cwd) };
}

async function writePlugin(dir: string, plugin: FixturePlugin): Promise<void> {
  const pluginRoot = path.join(dir, "plugins", plugin.name);
  await mkdir(path.join(pluginRoot, "skills", "greet"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin.name,
      version: "1.0.0",
      dependencies: plugin.dependencies ?? [],
    }),
  );
  await writeFile(
    path.join(pluginRoot, "skills", "greet", "SKILL.md"),
    `---\nname: greet\ndescription: greets from ${plugin.name}\n---\n\nHello.\n`,
  );
}

/** Writes the marketplace `name` in `dir`, each plugin with one skill. */
async function writeMarketplace(
  dir: string,
  name: string,
  plugins: readonly FixturePlugin[],
  allowed: readonly string[] = [],
): Promise<void> {
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(dir, ".claude-plugin", "marketplace.json"),
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
  await Promise.all(plugins.map((plugin) => writePlugin(dir, plugin)));
}

/** A git checkout of a marketplace whose `origin` is `url`. */
async function checkout(
  dir: string,
  name: string,
  url: string,
  plugins: readonly FixturePlugin[],
): Promise<string> {
  await writeMarketplace(dir, name, plugins);
  await git.init({ fs, dir, defaultBranch: "main" });
  await git.addRemote({ fs, dir, remote: "origin", url });
  return dir;
}

function gitDouble(
  url: string,
  fixture: string,
  listRemotesResult?: ListRemotesResult,
): GitOpsFake {
  return createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [url],
    cloneFixture: { boundary: "local", sourceDir: fixture },
    localRefs: { "refs/remotes/origin/HEAD": REMOTE_HEAD },
    ...(listRemotesResult === undefined ? {} : { listRemotesResult }),
  });
}

async function addToUser(
  env: Scopes,
  boundary: NotificationBoundary,
  rawSource: string,
  double?: GitOpsFake,
): Promise<void> {
  await addMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "user",
    cwd: env.cwd,
    completionCache: createCompletionCache(),
    rawSource,
    credentialOps: createCredentialOpsFake({ boundary: "memory" }).credentialOps,
    ...(double === undefined ? {} : { gitOps: double.gitOps }),
  });
}

/** Installs into the project scope, the install's add seam bound to `double`. */
async function installIntoProject(
  env: Scopes,
  boundary: NotificationBoundary,
  plugin: string,
  marketplace: string,
  double: GitOpsFake,
): Promise<void> {
  const install = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
  await install({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: env.cwd,
    marketplace,
    plugin,
    credentialOps: createCredentialOpsFake({ boundary: "memory" }).credentialOps,
    marketplaceAdd: {
      record: (args) => addMarketplaceToState({ ...args, gitOps: double.gitOps }),
      settle: (args) => settleAddedMarketplace({ ...args, gitOps: double.gitOps }),
    },
  });
}

/** Every path under `dir`, relative and sorted; an absent directory has none. */
async function treeOf(dir: string): Promise<readonly string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await readdir(dir, { recursive: true });
  return entries.sort();
}

/** The bytes `saveConfig` writes for `config`. */
function jsonFile(config: object): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? await readFile(filePath, "utf8") : undefined;
}

/** The scope each clone call staged into: `user`, `project`, or `elsewhere`. */
function cloneTargets(double: GitOpsFake, env: Scopes): readonly (readonly [string, string])[] {
  return double.state.calls.clone.map(({ dir, url }) => {
    const scope = [env.user, env.project].find(
      (locations) => !path.relative(locations.extensionRoot, dir).startsWith(".."),
    );
    return [url, scope?.scope ?? "elsewhere"] as const;
  });
}

test("LAYER-07: a project keeps the marketplace its install added after a user-scope remove", async (t) => {
  // arrange
  const env = await scopes(t, "project-adds-user-mp-");
  const fixture = await checkout(path.join(env.root, "checkout"), "mp", REPO_URL, [{ name: "p" }]);
  const double = gitDouble(REPO_URL, fixture);
  const boundary = createNotificationBoundary(6);
  await addToUser(env, boundary, REPO_URL, double);
  await installIntoProject(env, boundary, "p", "mp", double);
  const projectClone = await env.project.sourceCloneDir("mp");
  const projectState = await loadState(env.project.extensionRoot);
  const userState = await loadState(env.user.extensionRoot);
  const projectRecord = projectState.marketplaces.mp;
  assert.ok(projectRecord);
  const userRecord = userState.marketplaces.mp;
  assert.ok(userRecord);

  // act
  await removeMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    name: "mp",
    scope: "user",
    cwd: env.cwd,
    completionCache: createCompletionCache(),
  });
  await listPlugins({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    cwd: env.cwd,
    scope: "project",
  });
  await getPluginInfo({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    mcpStatus: noStatusSnapshot(),
    marketplace: "mp",
    plugin: "p",
    scope: "project",
    cwd: env.cwd,
  });
  const userTreeBeforeUpdate = await treeOf(env.user.extensionRoot);
  const fetchesBeforeUpdate = double.state.calls.fetch.length;
  await updateMarketplace({
    completionCache: createCompletionCache(),
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    name: "mp",
    scope: "project",
    cwd: env.cwd,
    gitOps: double.gitOps,
    credentialOps: createCredentialOpsFake({ boundary: "memory" }).credentialOps,
  });

  // assert
  assert.deepStrictEqual(await treeOf(env.project.skillsTargetDir), [
    "p-greet",
    "p-greet/SKILL.md",
  ]);
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [user] (added)" },
    { message: "● mp [project]\n  ● p v1.0.0 (installed)\n\n/reload to pick up changes" },
    { message: "● mp [user] (removed)" },
    { message: "● mp [project]\n  ● p v1.0.0 (installed)\n\nPlugin list: 1 success" },
    { message: "● mp [project] <no autoupdate>\n  ● p v1.0.0 (installed)\n    skills: greet" },
    { message: "● mp [project] (skipped) {up-to-date}" },
  ]);
  assert.deepStrictEqual(
    double.state.calls.fetch.slice(fetchesBeforeUpdate).map(({ dir }) => dir),
    [projectClone],
  );
  assert.deepStrictEqual(await treeOf(env.user.extensionRoot), userTreeBeforeUpdate);
  assert.deepStrictEqual(cloneTargets(double, env), [
    [REPO_URL, "user"],
    [REPO_URL, "project"],
  ]);
  assert.deepStrictEqual(
    [
      await pathExists(path.join(projectClone, ".git", "pi-claude-marketplace.json")),
      await git.getConfig({ fs, dir: projectClone, path: "remote.origin.url" }),
    ],
    [true, REPO_URL],
  );
  assert.deepStrictEqual(
    [
      path.relative(env.project.extensionRoot, projectRecord.marketplaceRoot),
      path.relative(env.project.extensionRoot, projectRecord.manifestPath),
      projectRecord.source,
    ],
    [
      path.join("sources", "mp"),
      path.join("sources", "mp", ".claude-plugin", "marketplace.json"),
      userRecord.source,
    ],
  );
  assert.strictEqual(
    await readIfPresent(env.project.baseConfigJsonPath),
    jsonFile({
      schemaVersion: 1,
      marketplaces: { mp: { source: REPO_URL } },
      plugins: { "p@mp": {} },
    }),
  );
  boundary.verifyBoundary();
});

/** What a failed project install must leave behind: no record, no clone, no declaration. */
async function projectFootprint(env: Scopes): Promise<readonly unknown[]> {
  return [
    Object.keys((await loadState(env.project.extensionRoot)).marketplaces),
    await treeOf(path.join(env.project.extensionRoot, "sources")),
    await treeOf(path.join(env.project.extensionRoot, "sources-staging")),
    await readIfPresent(env.project.baseConfigJsonPath),
  ];
}

test("LAYER-07 / WR-07: an install of a plugin the manifest does not list fails before the project clones the marketplace", async (t) => {
  // arrange
  const env = await scopes(t, "project-adds-user-mp-absent-");
  const fixture = await checkout(path.join(env.root, "checkout"), "mp", REPO_URL, [{ name: "p" }]);
  const double = gitDouble(REPO_URL, fixture);
  const boundary = createNotificationBoundary(2);
  await addToUser(env, boundary, REPO_URL, double);

  // act
  await installIntoProject(env, boundary, "ghost", "mp", double);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [user] (added)" },
    {
      message:
        'A plugin operation has failed.\n\n● mp [project]\n  ⊘ ghost (failed) {not in manifest}\n    cause: Plugin "ghost" not found in marketplace "mp".',
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(cloneTargets(double, env), [[REPO_URL, "user"]]);
  assert.deepStrictEqual(await projectFootprint(env), [[], [], [], undefined]);
  boundary.verifyBoundary();
});

test("MA-12: a project install replaces the extension's own leftover clone of the marketplace", async (t) => {
  // arrange
  const env = await scopes(t, "project-adds-user-mp-leftover-");
  const fixture = await checkout(path.join(env.root, "checkout"), "mp", REPO_URL, [{ name: "p" }]);
  const double = gitDouble(REPO_URL, fixture, { kind: "origin", url: REPO_URL });
  const boundary = createNotificationBoundary(2);
  await addToUser(env, boundary, REPO_URL, double);
  const leftover = await env.project.sourceCloneDir("mp");
  await mkdir(path.join(leftover, ".git"), { recursive: true });
  await writeFile(path.join(leftover, ".git", "pi-claude-marketplace.json"), "{}");
  await writeFile(path.join(leftover, "stale.txt"), "left behind");

  // act
  await installIntoProject(env, boundary, "p", "mp", double);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [user] (added)" },
    { message: "● mp [project]\n  ● p v1.0.0 (installed)\n\n/reload to pick up changes" },
  ]);
  assert.deepStrictEqual(
    [
      await pathExists(path.join(leftover, "stale.txt")),
      await pathExists(path.join(leftover, ".claude-plugin", "marketplace.json")),
      Object.keys((await loadState(env.project.extensionRoot)).marketplaces.mp?.plugins ?? {}),
    ],
    [false, true, ["p"]],
  );
  boundary.verifyBoundary();
});

test("MA-13: a project install refuses a foreign tree where the marketplace clone goes and keeps it", async (t) => {
  // arrange
  const env = await scopes(t, "project-adds-user-mp-foreign-");
  const fixture = await checkout(path.join(env.root, "checkout"), "mp", REPO_URL, [{ name: "p" }]);
  const double = gitDouble(REPO_URL, fixture);
  const boundary = createNotificationBoundary(2);
  await addToUser(env, boundary, REPO_URL, double);
  const foreign = await env.project.sourceCloneDir("mp");
  await mkdir(foreign, { recursive: true });
  await writeFile(path.join(foreign, "notes.txt"), "the user's notes");

  // act
  await installIntoProject(env, boundary, "p", "mp", double);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [user] (added)" },
    {
      message:
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ p (failed) {stale clone}\n    cause: stale source clone at mp",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(
    [await readFile(path.join(foreign, "notes.txt"), "utf8"), await projectFootprint(env)],
    ["the user's notes", [[], ["mp", path.join("mp", "notes.txt")], [], undefined]],
  );
  boundary.verifyBoundary();
});

test("LAYER-07 / D-MF-04: a project install reads the dependencies of the plugin from the clone it installs from", async (t) => {
  // arrange: the user clone predates the dependency the upstream now declares.
  const env = await scopes(t, "project-adds-user-mp-newer-");
  const before = await checkout(path.join(env.root, "before"), "mp", REPO_URL, [{ name: "app" }]);
  const after = await checkout(path.join(env.root, "after"), "mp", REPO_URL, [
    { name: "app", dependencies: ["lib"] },
    { name: "lib" },
  ]);
  const boundary = createNotificationBoundary(2);
  await addToUser(env, boundary, REPO_URL, gitDouble(REPO_URL, before));

  // act
  await installIntoProject(env, boundary, "app", "mp", gitDouble(REPO_URL, after));

  // assert
  const projectState = await loadState(env.project.extensionRoot);
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [user] (added)" },
    {
      message:
        "● mp [project]\n  ● app v1.0.0 (installed)\n  ● lib@mp v1.0.0 (installed)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(Object.keys(projectState.marketplaces.mp?.plugins ?? {}).sort(), [
    "app",
    "lib",
  ]);
  boundary.verifyBoundary();
});

test("LAYER-07: a project install adds the user-scope git marketplace of its dependency to the project", async (t) => {
  // arrange
  const env = await scopes(t, "project-adds-user-mp-dependency-");
  const upstream = path.join(env.root, "upstream");
  await writeMarketplace(
    upstream,
    "upstream",
    [{ name: "app", dependencies: ["lib@tools"] }],
    ["tools"],
  );
  const fixture = await checkout(path.join(env.root, "tools"), "tools", TOOLS_URL, [
    { name: "lib" },
  ]);
  const double = gitDouble(TOOLS_URL, fixture);
  const boundary = createNotificationBoundary(3);
  await addToUser(env, boundary, upstream);
  await addToUser(env, boundary, TOOLS_URL, double);

  // act
  await installIntoProject(env, boundary, "app", "upstream", double);

  // assert
  const toolsClone = await env.project.sourceCloneDir("tools");
  const projectState = await loadState(env.project.extensionRoot);
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● upstream [user] (added)" },
    { message: "● tools [user] (added)" },
    {
      message:
        "● upstream [project]\n  ● app v1.0.0 (installed)\n  ● lib@tools v1.0.0 (installed)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(cloneTargets(double, env), [
    [TOOLS_URL, "user"],
    [TOOLS_URL, "project"],
  ]);
  assert.deepStrictEqual(
    [
      projectState.marketplaces.tools?.marketplaceRoot,
      Object.entries(projectState.marketplaces).map(([name, record]) => [
        name,
        Object.keys(record.plugins),
      ]),
      await pathExists(path.join(toolsClone, ".git", "pi-claude-marketplace.json")),
    ],
    [
      toolsClone,
      [
        ["upstream", ["app"]],
        ["tools", ["lib"]],
      ],
      true,
    ],
  );
  assert.strictEqual(
    await readIfPresent(env.project.baseConfigJsonPath),
    jsonFile({
      schemaVersion: 1,
      marketplaces: { upstream: { source: upstream }, tools: { source: TOOLS_URL } },
      plugins: { "app@upstream": {} },
    }),
  );
  boundary.verifyBoundary();
});
