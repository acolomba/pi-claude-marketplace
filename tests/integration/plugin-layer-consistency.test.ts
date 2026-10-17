// tests/integration/plugin-layer-consistency.test.ts
//
// The same-layer marketplace rule on load (LAYER-06), through the real read
// pass, apply, and pending, with real layer and state files. A layer that
// declares a plugin whose marketplace only the other layer declares stops its
// scope's reload as an invalid layer file does (CFG-03): the plugins the scope
// already installed stay recorded, and no file is repaired. A plugin whose
// marketplace no layer declares keeps its own dangling reference row, and the
// rest of the scope still converges.

import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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
  "The local layer (claude-plugins.local.json) declares demo@mp, but only the shared layer declares its marketplace. Run /claude:plugin marketplace add <source> --local with the source the shared layer declares, or remove the plugin from the local layer.";

const SHARED_GAP_CAUSE =
  "The shared layer (claude-plugins.json) declares demo@mp, but only the local layer declares its marketplace. Run /claude:plugin marketplace add <source> with the source the local layer declares, or remove the plugin from the shared layer.";

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

/** Writes one layer file as a hand edit would. */
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

/** The cascade of a scope whose one layer file is invalid for the given cause. */
function layerError(basename: string, scope: Scope, cause: string, label: string): object {
  return {
    message:
      "Some operations have failed.\n" +
      "\n" +
      `⊘ ${basename} [${scope}] (failed) {invalid manifest}\n` +
      `  ⊘ ${basename} (failed) {invalid manifest}\n` +
      `    cause: ${cause}\n` +
      "\n" +
      `${label}: 2 failures`,
    severity: "error",
  };
}

test("a local layer that declares a plugin whose marketplace only the shared layer declares stops the reload and changes no file", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-local-", "project");
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    { message: "● mp [project] (added)\n  ● other (installed)\n\nReconcile: 2 successes" },
  ]);
  await writeLayer(scope.locations.configLocalJsonPath, { plugins: { "demo@mp": {} } });
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
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE, "Reconcile"),
  ]);
  assert.deepStrictEqual(pending.notifications, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE, "Reconcile pending"),
  ]);
  pending.verifyBoundary();
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a shared layer that declares a plugin whose marketplace only the local layer declares stops the reload and changes no file", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-shared-", "project");
  await writeLayer(scope.locations.configLocalJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    { message: "● mp [project] (added)\n  ● other (installed)\n\nReconcile: 2 successes" },
  ]);
  await writeLayer(scope.locations.configJsonPath, { plugins: { "demo@mp": {} } });
  const before = await treeBytes(scope.locations.scopeRoot);

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.json", "project", SHARED_GAP_CAUSE, "Reconcile"),
  ]);
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a local layer of the user scope that declares a plugin without its marketplace stops the user reload", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-user-", "user");
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
  });
  await writeLayer(scope.locations.configLocalJsonPath, { plugins: { "demo@mp": {} } });
  const before = await treeBytes(scope.locations.scopeRoot);

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "user", LOCAL_GAP_CAUSE, "Reconcile"),
  ]);
  assert.deepStrictEqual(await treeBytes(scope.locations.scopeRoot), before);
});

test("the local layer an earlier --local install wrote keeps its bytes and its plugin stays recorded", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-gap-legacy-", "project");
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "demo@mp": {} },
  });
  assert.deepStrictEqual(await reload(scope), [
    { message: "● mp [project] (added)\n  ● demo (installed)\n\nReconcile: 2 successes" },
  ]);
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
  });
  const legacy = '{"schemaVersion":1,"plugins":{"demo@mp":{}}}';
  await writeFile(scope.locations.configLocalJsonPath, legacy);
  const stateBytes = await readFile(scope.locations.stateJsonPath, "utf8");

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    layerError("claude-plugins.local.json", "project", LOCAL_GAP_CAUSE, "Reconcile"),
  ]);
  assert.equal(await readFile(scope.locations.configLocalJsonPath, "utf8"), legacy);
  assert.equal(await readFile(scope.locations.stateJsonPath, "utf8"), stateBytes);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["demo"]);
});

test("a plugin whose marketplace no layer declares keeps its dangling reference row while a declared plugin installs", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-dangling-", "project");
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  await writeLayer(scope.locations.configLocalJsonPath, { plugins: { "ghost@nowhere": {} } });

  // act
  const applied = await reload(scope);

  // assert
  assert.deepStrictEqual(applied, [
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "● mp [project] (added)\n" +
        "  ● other (installed)\n" +
        "\n" +
        "⊘ nowhere [project] (failed) {dangling reference}\n" +
        "  ⊘ ghost (failed) {dangling reference}\n" +
        "\n" +
        "Reconcile: 2 failures, 2 successes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});

test("a malformed plugin key reaches the planner's diagnostic and no layer error", async (t) => {
  // arrange
  const scope = await layerScope(t, "layer-malformed-", "project");
  await writeLayer(scope.locations.configJsonPath, {
    marketplaces: { mp: { source: scope.source } },
    plugins: { "other@mp": {} },
  });
  await writeLayer(scope.locations.configLocalJsonPath, { plugins: { "demo@": {} } });

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
        "  ● other (installed)\n" +
        "\n" +
        "Reconcile: 1 failure, 2 successes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await recordedPlugins(scope.locations), ["other"]);
});
