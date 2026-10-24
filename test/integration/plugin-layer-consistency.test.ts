// test/integration/plugin-layer-consistency.test.ts
//
// The same-layer marketplace rule on load (LAYER-06), through the real read
// pass, apply, and pending, with real layer and state files. A layer that
// declares a plugin whose marketplace only the other layer declares stops its
// scope's reload as an invalid layer config does (CFG-03): the plugins the scope
// already installed stay recorded, and no file is repaired. A plugin whose
// marketplace no layer declares keeps its own dangling reference row, and the
// rest of the scope still converges. Before the first-run migration writes the
// base layer, pending checks the layers the migration would leave (MIG-01).

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { pendingReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

const LOCAL_GAP_CAUSE =
  "The local config (claude-plugins.local.json) declares demo@mp, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.";

const BASE_GAP_CAUSE =
  "The base config (claude-plugins.json) declares demo@mp, but only the local config (claude-plugins.local.json) declares its marketplace. Run /claude:plugin marketplace add <source> --scope project with the source the local config declares, or remove the plugin from the base config.";

const USER_LOCAL_GAP_CAUSE =
  "The local config (claude-plugins.local.json) declares demo@mp, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope user with the source the base config declares, or remove the plugin from the local config.";

interface LayerScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /** The root of the path marketplace `mp`, which offers `demo` and `other`. */
  readonly source: string;
}

/** A case-owned Pi environment with the path marketplace `mp` on disk. */
async function layerScope(t: TestContext, prefix: string, scope: Scope): Promise<LayerScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const source = path.join(root, "mp");
  const names = ["demo", "other"];
  for (const name of names) {
    const skill = path.join(source, name, "skills", `${name}-skill`);
    await mkdir(skill, { recursive: true });
    await writeFile(
      path.join(skill, "SKILL.md"),
      `---\nname: ${name}-skill\ndescription: A skill of ${name}.\n---\n`,
    );
  }

  await mkdir(path.join(source, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(source, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: names.map((name) => ({ name, source: `./${name}`, version: "1.0.0" })),
    }),
  );
  return { cwd, locations: locationsFor(scope, cwd), source };
}

/** Writes one layer config as a hand edit would. */
async function writeLayer(
  filePath: string,
  declaration: {
    readonly marketplaces?: Readonly<Record<string, { readonly source: string }>>;
    readonly plugins?: Readonly<Record<string, object>>;
  },
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ schemaVersion: 1, ...declaration }, null, 2));
}

/** Runs one reload of `scope` and returns its notifications. */
async function reload(
  scope: LayerScope,
): Promise<ReturnType<typeof createNotificationBoundary>["notifications"]> {
  const boundary = createNotificationBoundary(1);
  await createApplyReconcile({ loadState })({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    scope: scope.locations.scope,
    completionCache: createCompletionCache(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    reason: "reload",
  });
  boundary.verifyBoundary();
  return boundary.notifications;
}

/** The names of the plugins the scope records under `mp`. */
async function recordedPlugins(locations: ScopedLocations): Promise<readonly string[]> {
  const state = await loadState(locations.extensionRoot);
  return Object.keys(state.marketplaces.mp?.plugins ?? {}).sort();
}

/** Every file under `root` with its bytes, in path order. */
async function treeBytes(root: string): Promise<readonly (readonly [string, string])[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  return Promise.all(
    files.map(async (file) => [path.relative(root, file), await readFile(file, "utf8")] as const),
  );
}

/**
 * The reload cascade, or with the `Reconcile pending` label the pending diff, of
 * a scope whose one layer config is invalid for the given cause: one failed row
 * under the file's block.
 */
function layerError(
  basename: string,
  scope: Scope,
  cause: string,
  label: "Reconcile" | "Reconcile pending" = "Reconcile",
): object {
  return {
    message:
      "A plugin operation has failed.\n" +
      "\n" +
      `● ${basename} [${scope}]\n` +
      `  ⊘ ${basename} (failed) {invalid manifest}\n` +
      `    cause: ${cause}\n` +
      "\n" +
      `${label}: 1 failure`,
    severity: "error",
  };
}

test("a local layer that declares a plugin whose marketplace only the base layer declares stops the reload and changes no file", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-local-", "project");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    {
      message:
        "● mp [project] (added)\n  ● other v1.0.0 (installed)\n\nReconcile: 2 successes\n\n/reload to pick up changes",
    },
  ]);
  await writeLayer(scope.locations.localConfigJsonPath, { plugins: { "demo@mp": {} } });
  const before = await treeBytes(scope.locations.scopeRoot);
  const pending = createNotificationBoundary(1);

  // act
  const applied = await reload(scope);
  await pendingReconcile({
    ctx: pending.ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    scope: "project",
  });

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE),
  ]);
  assert.deepStrictEqual(pending.notifications, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE, "Reconcile pending"),
  ]);
  pending.verifyBoundary();
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a base layer that declares a plugin whose marketplace only the local layer declares stops the reload and changes no file", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-base-", "project");
  await writeLayer(scope.locations.localConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    {
      message:
        "● mp [project] (added)\n  ● other v1.0.0 (installed)\n\nReconcile: 2 successes\n\n/reload to pick up changes",
    },
  ]);
  await writeLayer(scope.locations.baseConfigJsonPath, { plugins: { "demo@mp": {} } });
  const before = await treeBytes(scope.locations.scopeRoot);

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [layerError("claude-plugins.json", "project", BASE_GAP_CAUSE)]);
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a local layer of the user scope that declares a plugin without its marketplace stops the user reload", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-user-", "user");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
  });
  await writeLayer(scope.locations.localConfigJsonPath, { plugins: { "demo@mp": {} } });
  const before = await treeBytes(scope.locations.scopeRoot);

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "user", USER_LOCAL_GAP_CAUSE),
  ]);
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
});

test("the local layer an earlier --local install wrote keeps its bytes and its plugin stays recorded", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-legacy-", "project");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "demo@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    {
      message:
        "● mp [project] (added)\n  ● demo v1.0.0 (installed)\n\nReconcile: 2 successes\n\n/reload to pick up changes",
    },
  ]);
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
  });
  const legacy = '{"schemaVersion":1,"plugins":{"demo@mp":{}}}';
  await writeFile(scope.locations.localConfigJsonPath, legacy);
  const stateBytes = await readFile(scope.locations.stateJsonPath, "utf8");

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE),
  ]);
  assert.equal(await readFile(scope.locations.localConfigJsonPath, "utf8"), legacy);
  assert.equal(await readFile(scope.locations.stateJsonPath, "utf8"), stateBytes);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["demo"]);
});

test("before the first-run migration, pending reports the layer error the reload stops on", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-premigration-", "project");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "demo@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    {
      message:
        "● mp [project] (added)\n  ● demo v1.0.0 (installed)\n\nReconcile: 2 successes\n\n/reload to pick up changes",
    },
  ]);
  await rm(scope.locations.baseConfigJsonPath);
  await writeLayer(scope.locations.localConfigJsonPath, { plugins: { "demo@mp": {} } });
  const pending = createNotificationBoundary(1);

  // act
  await pendingReconcile({
    ctx: pending.ctx,
    run: runWithNothingLoaded(),
    cwd: scope.cwd,
    scope: "project",
  });
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(pending.notifications, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE, "Reconcile pending"),
  ]);
  pending.verifyBoundary();
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE),
  ]);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["demo"]);
});

test("a plugin whose marketplace no layer declares keeps its dangling reference row while a declared plugin installs", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-dangling-", "project");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  await writeLayer(scope.locations.localConfigJsonPath, { plugins: { "ghost@nowhere": {} } });

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "● mp [project] (added)\n" +
        "  ● other v1.0.0 (installed)\n" +
        "\n" +
        "⊘ nowhere [project] (failed) {dangling reference}\n" +
        "  ⊘ ghost (failed) {dangling reference}\n" +
        "\n" +
        "Reconcile: 2 failures, 2 successes\n" +
        "\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a malformed plugin key reaches the planner's diagnostic and no layer error", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-malformed-", "project");
  await writeLayer(scope.locations.baseConfigJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  await writeLayer(scope.locations.localConfigJsonPath, { plugins: { "demo@": {} } });

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    {
      message:
        "A marketplace operation has failed.\n" +
        "\n" +
        "⊘ demo@ [project] (failed) {source mismatch}\n" +
        "\n" +
        "● mp [project] (added)\n" +
        "  ● other v1.0.0 (installed)\n" +
        "\n" +
        "Reconcile: 1 failure, 2 successes\n" +
        "\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});
