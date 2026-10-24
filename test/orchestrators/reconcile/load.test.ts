// Owner suite for orchestrators/reconcile/load.ts.
//
// APL-03 / D-02: the load's contract is what it leaves on disk -- nothing --
// and the one cascade it renders for the rows that return every session. Each
// case shapes a project scope on a case-owned temporary tree and runs the real
// read pass, the real routing owner and the real persistence. The MCP move is
// injected only where its input is the promise.
//
// IL-2 is proved by sizing the notification boundary: each case promises the
// exact number of emissions it expects, so an unexpected one throws where it is
// made. A load with nothing to report promises zero.

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { createLoadReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { LoadReconcileOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import type { McpMigrationStep } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

const loadReconcile = createLoadReconcile({ loadState });

/** One load over the case's tree with a fresh routing owner. */
function load(opts: Omit<LoadReconcileOptions, "hooksRouting" | "run">): Promise<void> {
  return loadReconcile({
    ...opts,
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
  });
}

interface InstalledPlugin {
  readonly enabled?: boolean;
  /** Bare tokens written into the plugin's own manifest and its catalog entry. */
  readonly dependencies?: readonly string[];
}

interface LoadScope {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
  /** The path marketplace `mp` every seeded state records. */
  readonly marketplaceRoot: string;
}

async function createLoadScope(t: TestContext, label: string): Promise<LoadScope> {
  const { cwd } = await createHermeticEnvironment(t, `load-${label}-`);
  return {
    cwd,
    project: locationsFor("project", cwd),
    user: locationsFor("user", cwd),
    marketplaceRoot: path.join(cwd, "mp-src"),
  };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/**
 * Lay down marketplace `mp` at `marketplaceRoot` listing `listed`, give every
 * plugin in `installed` its own manifest, and record `installed` in the scope's
 * state.json.
 */
async function seedInstalled(
  scope: LoadScope,
  locations: ScopedLocations,
  installed: Readonly<Record<string, InstalledPlugin>>,
  listed: readonly string[],
): Promise<void> {
  const root = scope.marketplaceRoot;
  await writeUnder(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: listed.map((name) => ({
        name,
        version: "1.0.0",
        source: `./plugins/${name}`,
        dependencies: [...(installed[name]?.dependencies ?? [])],
      })),
    }),
  );
  const records: Record<string, PluginRecord> = {};
  for (const [name, plugin] of Object.entries(installed)) {
    const pluginRoot = path.join(root, "plugins", name);
    await writeUnder(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name, version: "1.0.0", dependencies: plugin.dependencies ?? [] }),
    );
    records[name] = {
      version: "1.0.0",
      resolvedSource: pluginRoot,
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled: plugin.enabled ?? true,
      provenance: "explicit",
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: locations.scope,
        source: pathSource(root),
        addedFromCwd: scope.cwd,
        manifestPath: path.join(root, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: root,
        plugins: records,
      },
    },
  });
}

/** The bytes of a base config declaring `mp` at `source` and the given plugins. */
function declaring(source: string, plugins: Readonly<Record<string, object>>): string {
  return JSON.stringify({ schemaVersion: 1, marketplaces: { mp: { source } }, plugins });
}

/** Both files a load must never write, read back as bytes plus the state's mtime. */
async function scopeFiles(locations: ScopedLocations): Promise<readonly unknown[]> {
  return [
    await readFile(locations.stateJsonPath, "utf8"),
    (await stat(locations.stateJsonPath)).mtimeMs,
    await readFile(locations.baseConfigJsonPath, "utf8"),
  ];
}

test("APL-03: a config that declares a plugin the scope never installed installs nothing and stays silent", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "declared-only");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  assert.deepStrictEqual(await retryTree(scope.project.scopeRoot), [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/state.json",
  ]);
  verifyBoundary();
});

for (const { name, plugins, installed } of [
  {
    name: "a record its config no longer declares stays installed",
    plugins: {},
    installed: { hello: {} },
  },
  {
    name: "a record its config declares disabled stays enabled",
    plugins: { "hello@mp": { enabled: false } },
    installed: { hello: {} },
  },
  {
    name: "a disabled record its config declares enabled stays disabled",
    plugins: { "hello@mp": {} },
    installed: { hello: { enabled: false } },
  },
  {
    name: "D-21: a record whose declared dependency is missing stays enabled",
    plugins: { "hello@mp": {} },
    installed: { hello: { dependencies: ["helper"] } },
  },
] as const) {
  test(`APL-03: ${name} and the load stays silent`, async (t) => {
    // arrange
    const scope = await createLoadScope(t, "kept-record");
    await seedInstalled(scope, scope.project, installed, ["hello", "helper"]);
    await writeUnder(scope.project.baseConfigJsonPath, declaring(scope.marketplaceRoot, plugins));
    const before = await scopeFiles(scope.project);
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    await load({ ctx, cwd: scope.cwd });

    // assert
    assert.deepStrictEqual(notifications, []);
    assert.deepStrictEqual(await scopeFiles(scope.project), before);
    verifyBoundary();
  });
}

test("D-18: a recorded plugin its marketplace no longer lists gets the not-in-manifest warning on every load", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "delisted");
  await seedInstalled(scope, scope.project, { gone: {} }, []);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "gone@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const warning = {
    message:
      "A plugin operation needs attention.\n" +
      "\n" +
      "● mp [project]\n" +
      "  ⊘ gone (failed) {not in manifest}\n" +
      '    cause: Plugin "gone" not found in marketplace "mp"\n' +
      "\n" +
      "Reconcile: 1 warning",
    severity: "warning",
  } as const;
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);

  // act
  await load({ ctx, cwd: scope.cwd });
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [warning, warning]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("D-18 / REC-05: a declarer whose own manifest cannot be read gets its warning and nothing is disabled", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "unreadable-declarer");
  await seedInstalled(scope, scope.project, { broken: {} }, ["broken"]);
  await writeUnder(
    path.join(scope.marketplaceRoot, "plugins", "broken", ".claude-plugin", "plugin.json"),
    "{ truncated",
  );
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "broken@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n" +
        "\n" +
        "● mp [project]\n" +
        "  ⊘ broken (failed) {unreadable manifest}\n" +
        "    cause: cannot read the dependencies of broken@mp: its own manifest is present but cannot be read\n" +
        "\n" +
        "Reconcile: 1 warning",
      severity: "warning",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("CFG-03: an unparseable config reports its row and changes nothing", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "invalid-config");
  await seedInstalled(scope, scope.project, { hello: {} }, ["hello"]);
  await writeUnder(scope.project.baseConfigJsonPath, "{");
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

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
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("a marketplace declared from another source than the one recorded reports a source mismatch and changes nothing", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "source-mismatch");
  await seedInstalled(scope, scope.project, { hello: {} }, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(path.join(scope.cwd, "elsewhere"), { "hello@mp": {} }),
  );
  const before = await scopeFiles(scope.project);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n" +
        "\n" +
        "⊘ mp [project] (failed) {source mismatch}\n" +
        "\n" +
        "Reconcile: 1 failure",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(await scopeFiles(scope.project), before);
  verifyBoundary();
});

test("WR-05: a pristine workspace stays silent and creates nothing in either scope", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "pristine");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await retryTree(scope.project.scopeRoot), []);
  assert.deepStrictEqual(await retryTree(scope.user.scopeRoot), []);
  verifyBoundary();
});

test("WR-01: a project state file that cannot be parsed still lets the user scope's warning through", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "one-scope-fails");
  await writeUnder(scope.project.stateJsonPath, "{ not json");
  await seedInstalled(scope, scope.user, { gone: {} }, []);
  await writeUnder(scope.user.baseConfigJsonPath, declaring(scope.marketplaceRoot, {}));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await load({ ctx, cwd: scope.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n" +
        "\n" +
        "● mp [user]\n" +
        "  ⊘ gone (failed) {not in manifest}\n" +
        '    cause: Plugin "gone" not found in marketplace "mp"\n' +
        "\n" +
        "⊘ state.json [project] (failed) {unparseable}\n" +
        "  ⊘ state.json (failed) {unparseable}\n" +
        "    cause: state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)\n" +
        "\n" +
        "Reconcile: 2 failures, 1 warning",
      severity: "error",
    },
  ]);
  assert.equal(await readFile(scope.project.stateJsonPath, "utf8"), "{ not json");
  verifyBoundary();
});

test("D-22 / AMIG-04: the MCP move runs for each readable scope with the plan its read pass computed", async (t) => {
  // arrange
  const scope = await createLoadScope(t, "mcp-move");
  await seedInstalled(scope, scope.project, {}, ["hello"]);
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring(scope.marketplaceRoot, { "hello@mp": {} }),
  );
  const moves: unknown[] = [];
  const migrateMcpEntries: McpMigrationStep = (input) => {
    moves.push({
      scope: input.scope,
      cwd: input.cwd,
      installs: input.plan?.pluginsToInstall.map((planned) => planned.plugin),
    });
    return Promise.resolve();
  };

  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

  // act
  await load({ ctx, cwd: scope.cwd, migrateMcpEntries });

  // assert
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(moves, [
    { scope: "project", cwd: scope.cwd, installs: ["hello"] },
    { scope: "user", cwd: scope.cwd, installs: undefined },
  ]);
  verifyBoundary();
});
