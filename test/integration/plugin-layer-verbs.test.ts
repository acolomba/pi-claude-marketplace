// test/integration/plugin-layer-verbs.test.ts
//
// The named plugin verbs across a scope's two layers, through the real
// install, uninstall, enable and disable, update, and reinstall operations,
// both layer configs, the state file, and the scope lock. A path marketplace
// keeps every case offline. A named verb acts on one layer and reads both, so
// a layer it cannot read stops it before anything changes (LAYER-04, CFG-03).
// Update and reinstall write no layer config, so a dependency that the load-time
// backfill reinstalls or a bare update moves stays undeclared (LAYER-08). A
// layer that gets a plugin declaration also gets its marketplace's, from the
// other layer's source when the scope's record holds none (LAYER-06).

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import {
  createEnableOperation,
  createInstallOperation,
  createReinstallOperation,
  createUninstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import {
  createNodeReinstallPlugins,
  createReinstallPlugin,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";

/** A plugin the marketplace `mp` offers, with the dependencies its manifest declares. */
interface FixturePlugin {
  readonly name: string;
  readonly dependencies?: readonly string[];
}

const PLUGINS: readonly FixturePlugin[] = [
  { name: "alpha" },
  { name: "beta" },
  { name: "app", dependencies: ["lib"] },
  { name: "lib" },
];

interface LayerScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /** The root of the path marketplace `mp`. */
  readonly source: string;
}

/** Writes the path marketplace `mp`, every plugin at `version` with one skill. */
async function publish(source: string, version: string): Promise<void> {
  await mkdir(path.join(source, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(source, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: PLUGINS.map(({ name }) => ({ name, source: `./plugins/${name}`, version })),
    }),
  );
  for (const plugin of PLUGINS) {
    const pluginRoot = path.join(source, "plugins", plugin.name);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(pluginRoot, "skills", `${plugin.name}-skill`), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin.name, version, dependencies: plugin.dependencies ?? [] }),
    );
    await writeFile(
      path.join(pluginRoot, "skills", `${plugin.name}-skill`, "SKILL.md"),
      `---\nname: ${plugin.name}-skill\ndescription: A skill of ${plugin.name}.\n---\n`,
    );
  }
}

/** The production operations of one command run, bound to one routing owner. */
function operations(): {
  readonly install: ReturnType<typeof createInstallOperation>;
  readonly uninstall: ReturnType<typeof createUninstallOperation>;
  readonly setPluginEnabled: ReturnType<typeof createEnableOperation>;
  readonly updatePlugins: ReturnType<typeof createPluginUpdateOperations>["updatePlugins"];
  readonly reinstallPlugins: ReturnType<typeof createNodeReinstallPlugins>;
  readonly reinstallPlugin: ReturnType<typeof createReinstallOperation>;
} {
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  return {
    install: createInstallOperation(hooksRouting, completionCache),
    uninstall: createUninstallOperation(hooksRouting, completionCache),
    setPluginEnabled: createEnableOperation(hooksRouting),
    updatePlugins: createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
    reinstallPlugins: createNodeReinstallPlugins(
      createReinstallPlugin(hooksRouting, completionCache),
    ),
    reinstallPlugin: createReinstallOperation(hooksRouting, completionCache),
  };
}

type Operations = ReturnType<typeof operations>;

/** The fields every verb takes for one command run in the project scope. */
function request(
  scope: LayerScope,
  boundary: NotificationBoundary,
  local: boolean,
): {
  readonly ctx: NotificationBoundary["ctx"];
  readonly run: ReturnType<typeof runWithNothingLoaded>;
  readonly scope: "project";
  readonly cwd: string;
  readonly local: boolean;
} {
  return {
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    local,
  };
}

/**
 * A project scope whose base layer declares the path marketplace `mp`, and
 * which installs `plugin` into the layer `local` names, then runs `extra`. The
 * setup fails unless every step succeeds.
 */
async function installedScope(
  t: TestContext,
  prefix: string,
  plugin: string,
  local: boolean,
  extra?: NamedVerb["extra"],
): Promise<LayerScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const source = path.join(root, "mp");
  await publish(source, "1.0.0");
  const scope = { cwd, locations: locationsFor("project", cwd), source };
  const boundary = createNotificationBoundary(extra === undefined ? 2 : 3);
  await addMarketplace({
    ...request(scope, boundary, false),
    rawSource: source,
    completionCache: createCompletionCache(),
  });
  await operations().install({ ...request(scope, boundary, local), marketplace: "mp", plugin });
  await extra?.(scope, boundary, local);
  boundary.verifyBoundary();
  assert.deepStrictEqual(
    boundary.notifications.filter((notification) => notification.severity !== undefined),
    [],
  );
  return scope;
}

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? await readFile(filePath, "utf8") : undefined;
}

/** The bytes of both layer configs; an absent file reads as undefined. */
async function layerConfigs(scope: LayerScope): Promise<readonly (string | undefined)[]> {
  return [
    await readIfPresent(scope.locations.baseConfigJsonPath),
    await readIfPresent(scope.locations.localConfigJsonPath),
  ];
}

/** The bytes of both layer configs and the state file. */
async function scopeFiles(scope: LayerScope): Promise<readonly (string | undefined)[]> {
  return [...(await layerConfigs(scope)), await readIfPresent(scope.locations.stateJsonPath)];
}

/** A verb's target layer, and the other layer the case makes unreadable. */
interface Direction {
  readonly flag: "" | " --local";
  readonly local: boolean;
  readonly unreadable: "claude-plugins.json" | "claude-plugins.local.json";
  readonly unreadablePath: (locations: ScopedLocations) => string;
}

const DIRECTIONS: readonly Direction[] = [
  {
    flag: "",
    local: false,
    unreadable: "claude-plugins.local.json",
    unreadablePath: (locations) => locations.localConfigJsonPath,
  },
  {
    flag: " --local",
    local: true,
    unreadable: "claude-plugins.json",
    unreadablePath: (locations) => locations.baseConfigJsonPath,
  },
];

/** A named verb on a scope that installed `alpha` into the verb's target layer. */
interface NamedVerb {
  readonly command: string;
  readonly plugin: string;
  /** A setup step after the install, in the target layer. */
  readonly extra?: (
    scope: LayerScope,
    boundary: NotificationBoundary,
    local: boolean,
  ) => Promise<unknown>;
  readonly act: (ops: Operations, base: ReturnType<typeof request>) => Promise<unknown>;
}

const NAMED_VERBS: readonly NamedVerb[] = [
  {
    command: "install beta@mp",
    plugin: "beta",
    act: (ops, base) => ops.install({ ...base, marketplace: "mp", plugin: "beta" }),
  },
  {
    command: "uninstall alpha@mp",
    plugin: "alpha",
    act: (ops, base) => ops.uninstall({ ...base, marketplace: "mp", plugin: "alpha" }),
  },
  {
    command: "enable alpha@mp",
    plugin: "alpha",
    extra: (scope, boundary, local) =>
      operations().setPluginEnabled({
        ...request(scope, boundary, local),
        marketplace: "mp",
        plugin: "alpha",
        enable: false,
      }),
    act: (ops, base) =>
      ops.setPluginEnabled({ ...base, marketplace: "mp", plugin: "alpha", enable: true }),
  },
  {
    command: "disable alpha@mp",
    plugin: "alpha",
    act: (ops, base) =>
      ops.setPluginEnabled({ ...base, marketplace: "mp", plugin: "alpha", enable: false }),
  },
  {
    command: "update alpha@mp",
    plugin: "alpha",
    act: (ops, base) =>
      ops.updatePlugins({
        ...base,
        target: { kind: "plugin", plugin: "alpha", marketplace: "mp" },
      }),
  },
  {
    command: "reinstall alpha@mp",
    plugin: "alpha",
    act: (ops, base) =>
      ops.reinstallPlugins({
        ...base,
        target: { kind: "plugin", plugin: "alpha", marketplace: "mp" },
      }),
  },
];

/** The one row a named verb renders when a layer config cannot be read (CFG-03). */
function invalidLayerRow(
  plugin: string,
  basename: string,
): { readonly message: string; readonly severity: "error" } {
  return {
    message:
      "A plugin operation has failed.\n" +
      "\n" +
      "● mp [project]\n" +
      `  ⊘ ${plugin} (failed) {invalid manifest}\n` +
      `    cause: Config file "${basename}" failed schema validation.`,
    severity: "error",
  };
}

for (const { flag, local, unreadable, unreadablePath } of DIRECTIONS) {
  for (const { command, plugin, extra, act } of NAMED_VERBS) {
    test(`LAYER-04: ${command}${flag} is refused while ${unreadable} cannot be read, and changes nothing`, async (t) => {
      // arrange
      const scope = await installedScope(t, "plugin-layer-verbs-", "alpha", local, extra);
      await writeFile(unreadablePath(scope.locations), "{ not json");
      const before = await scopeFiles(scope);
      const boundary = createNotificationBoundary(1);

      // act
      await act(operations(), request(scope, boundary, local));

      // assert
      assert.deepStrictEqual(boundary.notifications, [invalidLayerRow(plugin, unreadable)]);
      assert.deepStrictEqual(await scopeFiles(scope), before);
      boundary.verifyBoundary();
    });
  }
}

/** Both layer configs parsed; an absent file reads as undefined. */
async function declarations(scope: LayerScope): Promise<readonly unknown[]> {
  const files = await layerConfigs(scope);
  return files.map((bytes): unknown => (bytes === undefined ? undefined : JSON.parse(bytes)));
}

/** The layers after a flagless install of `app`: the base layer declares it, never `lib`. */
function baseDeclaresApp(source: string): readonly unknown[] {
  return [
    { schemaVersion: 1, marketplaces: { mp: { source } }, plugins: { "app@mp": {} } },
    undefined,
  ];
}

test("LAYER-08: the load-time backfill's reinstall of a dependency writes no layer config", async (t) => {
  // arrange
  const scope = await installedScope(t, "plugin-layer-backfill-", "app", false);
  const before = await layerConfigs(scope);
  const boundary = createNotificationBoundary(0);

  // act
  const outcome = await operations().reinstallPlugin({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    marketplace: "mp",
    plugin: "lib",
    render: "none",
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "reinstalled",
    name: "lib",
    marketplace: "mp",
    scope: "project",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  });
  assert.deepStrictEqual(await layerConfigs(scope), before);
  assert.deepStrictEqual(await declarations(scope), baseDeclaresApp(scope.source));
  boundary.verifyBoundary();
});

test("LAYER-08: a bare update moves a dependency to its new version and writes no layer config", async (t) => {
  // arrange
  const scope = await installedScope(t, "plugin-layer-bare-update-", "app", false);
  await publish(scope.source, "1.1.0");
  const before = await layerConfigs(scope);
  const boundary = createNotificationBoundary(1);

  // act
  await operations().updatePlugins({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    target: { kind: "all" },
  });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    {
      message:
        "● mp [project]\n" +
        "  ● lib v1.0.0 → v1.1.0 (updated)\n" +
        "  ● app v1.0.0 → v1.1.0 (updated)\n" +
        "\n" +
        "Plugin update: 2 updated\n" +
        "\n" +
        "/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(await layerConfigs(scope), before);
  assert.deepStrictEqual(await declarations(scope), baseDeclaresApp(scope.source));
  const state = await loadState(scope.locations.extensionRoot);
  assert.deepStrictEqual(
    Object.entries(state.marketplaces.mp?.plugins ?? {}).map(([name, record]) => [
      name,
      record.version,
      record.provenance,
    ]),
    [
      ["lib", "1.1.0", "dependency"],
      ["app", "1.1.0", "explicit"],
    ],
  );
  boundary.verifyBoundary();
});

/** LAYER-06: the scope records `mp` with a source of a kind this version does not know, and no `raw`. */
async function forgetRecordedSource(scope: LayerScope): Promise<void> {
  const state = JSON.parse(await readFile(scope.locations.stateJsonPath, "utf8")) as {
    marketplaces: { mp: { source: unknown } };
  };
  state.marketplaces.mp.source = { kind: "unknown", reason: "a future source kind" };
  await writeFile(scope.locations.stateJsonPath, JSON.stringify(state));
}

test("LAYER-06: install --local of a plugin the base layer installed declares the marketplace with the base layer's source when the record holds none", async (t) => {
  // arrange
  const scope = await installedScope(t, "plugin-layer-base-source-", "alpha", false);
  await forgetRecordedSource(scope);
  const boundary = createNotificationBoundary(1);

  // act
  await operations().install({
    ...request(scope, boundary, true),
    marketplace: "mp",
    plugin: "alpha",
  });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project]\n  ⊘ alpha v1.0.0 (skipped) {already installed in base layer}" },
  ]);
  assert.deepStrictEqual(await declarations(scope), [
    {
      schemaVersion: 1,
      marketplaces: { mp: { source: scope.source } },
      plugins: { "alpha@mp": {} },
    },
    {
      schemaVersion: 1,
      marketplaces: { mp: { source: scope.source } },
      plugins: { "alpha@mp": {} },
    },
  ]);
  boundary.verifyBoundary();
});

test("LAYER-06: install --local is refused and changes nothing when no layer declares the marketplace and the record holds no source", async (t) => {
  // arrange
  const scope = await installedScope(t, "plugin-layer-no-source-", "alpha", false);
  await forgetRecordedSource(scope);
  await writeFile(
    scope.locations.baseConfigJsonPath,
    JSON.stringify({ schemaVersion: 1, plugins: { "alpha@mp": {} } }),
  );
  const before = await scopeFiles(scope);
  const boundary = createNotificationBoundary(1);

  // act
  await operations().install({
    ...request(scope, boundary, true),
    marketplace: "mp",
    plugin: "alpha",
  });

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    {
      message:
        "A plugin operation has failed.\n" +
        "\n" +
        "● mp [project]\n" +
        "  ⊘ alpha (failed) {unsupported source}\n" +
        "    cause: The scope records the marketplace mp with no source that the local config (claude-plugins.local.json) can declare. Declare the marketplace in the local config, then run the command again.",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope), before);
  boundary.verifyBoundary();
});
