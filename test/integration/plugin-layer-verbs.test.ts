// test/integration/plugin-layer-verbs.test.ts
//
// Install with --local across a scope's two layers, through the real install
// operation, both layer configs, the state file, and the scope lock. A path
// marketplace keeps every case offline. When the scope's record holds no
// marketplace source, an install with --local declares the marketplace in the
// local layer with the base layer's source. When no layer declares the
// marketplace either, the install is refused and changes nothing (LAYER-06).
// Each case rewrites the recorded marketplace source to a kind this release
// does not know, a state that no user command can produce.

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
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";

interface LayerScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /** The root of the path marketplace `mp`. */
  readonly source: string;
}

/** Writes the path marketplace `mp`, which offers `alpha` 1.0.0 with one skill. */
async function publish(source: string): Promise<void> {
  const pluginRoot = path.join(source, "plugins", "alpha");
  await mkdir(path.join(source, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(source, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "alpha", source: "./plugins/alpha", version: "1.0.0" }],
    }),
  );
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "alpha-skill"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "alpha", version: "1.0.0" }),
  );
  await writeFile(
    path.join(pluginRoot, "skills", "alpha-skill", "SKILL.md"),
    "---\nname: alpha-skill\ndescription: A skill of alpha.\n---\n",
  );
}

/** The production install operation of one command run, bound to one routing owner. */
function installOperation(): ReturnType<typeof createInstallOperation> {
  return createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

/** The fields an install takes for one command run in the project scope. */
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
 * A project scope whose base layer declares the path marketplace `mp` and the
 * plugin `alpha`, which the scope installs. The setup fails unless every step
 * succeeds.
 */
async function installedScope(t: TestContext, prefix: string): Promise<LayerScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const source = path.join(root, "mp");
  await publish(source);
  const scope = { cwd, locations: locationsFor("project", cwd), source };
  const boundary = createNotificationBoundary(2);
  await addMarketplace({
    ...request(scope, boundary, false),
    rawSource: source,
    completionCache: createCompletionCache(),
  });
  await installOperation()({
    ...request(scope, boundary, false),
    marketplace: "mp",
    plugin: "alpha",
  });
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

/** Both layer configs parsed; an absent file reads as undefined. */
async function declarations(scope: LayerScope): Promise<readonly unknown[]> {
  const files = await layerConfigs(scope);
  return files.map((bytes): unknown => (bytes === undefined ? undefined : JSON.parse(bytes)));
}

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
  const scope = await installedScope(t, "plugin-layer-base-source-");
  await forgetRecordedSource(scope);
  const boundary = createNotificationBoundary(1);

  // act
  await installOperation()({
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
  const scope = await installedScope(t, "plugin-layer-no-source-");
  await forgetRecordedSource(scope);
  await writeFile(
    scope.locations.baseConfigJsonPath,
    JSON.stringify({ schemaVersion: 1, plugins: { "alpha@mp": {} } }),
  );
  const before = await scopeFiles(scope);
  const boundary = createNotificationBoundary(1);

  // act
  await installOperation()({
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
