// Owner suite for orchestrators/reconcile/read-pass.ts.
//
// The read pass reads the real merged config and the real state off a
// case-owned temporary tree, so every case shapes its inputs on disk. The only
// doubles are the injected MCP move step and the hook routing owner, whose one
// call is the routing rebuild's promise.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { MigrateConfigSaveError } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import {
  closeScopePass,
  notifyScopeOutcomes,
  notifyScopePasses,
  openScopePass,
  readPassForScope,
  readPlainPlanForScope,
  runScopeIsolated,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { InstallHooksRouting } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type {
  ReconcileStateReader,
  ScopePassAccumulators,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts";
import type {
  McpMigrationInput,
  McpMigrationStep,
  ReconcilePlan,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

const reader = { loadState };

interface ProjectScope {
  readonly cwd: string;
  readonly project: ScopedLocations;
  /** The path marketplace `mp` the seeded state records. */
  readonly marketplaceRoot: string;
  /**
   * Change `entry`'s mode for the rest of the case, which is how a permission
   * case provokes a real EACCES. The mode is restored before the tree is removed.
   */
  readonly setMode: (entry: string, mode: number) => Promise<void>;
}

/** One case-owned project root; every mode change is undone before the tree is removed. */
async function createProjectScope(t: TestContext, label: string): Promise<ProjectScope> {
  // Registered before the environment so the modes come back before its
  // removal runs: after-hooks run in registration order.
  const changed: string[] = [];
  t.after(async () => {
    for (const entry of changed) {
      await chmod(entry, 0o755);
    }
  });
  const { cwd } = await createHermeticEnvironment(t, `read-pass-${label}-`);
  return {
    cwd,
    project: locationsFor("project", cwd),
    marketplaceRoot: path.join(cwd, "mp-src"),
    setMode: async (entry, mode) => {
      // A mode does not bind uid 0, so the EACCES never happens under root.
      if (typeof process.getuid === "function" && process.getuid() === 0) {
        throw new Error("permission cases cannot run as root");
      }

      changed.push(entry);
      await chmod(entry, mode);
    },
  };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/** A canonical state recording the path marketplace `mp` with no plugin. */
function recordedState(scope: ProjectScope): ExtensionState {
  return {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource(scope.marketplaceRoot),
        addedFromCwd: scope.cwd,
        manifestPath: path.join(scope.marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: scope.marketplaceRoot,
        plugins: {},
      },
    },
  };
}

async function seedRecordedState(scope: ProjectScope): Promise<void> {
  await mkdir(scope.project.extensionRoot, { recursive: true });
  await saveState(scope.project.extensionRoot, recordedState(scope));
}

function declaring(
  marketplaces: Readonly<Record<string, string>>,
  plugins: Readonly<Record<string, object>> = {},
): string {
  return JSON.stringify({
    schemaVersion: 1,
    marketplaces: Object.fromEntries(
      Object.entries(marketplaces).map(([name, source]) => [name, { source }]),
    ),
    plugins,
  });
}

function planOf(fields: Partial<Omit<ReconcilePlan, "scope">>): ReconcilePlan {
  return {
    scope: "project",
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    pluginsToDependencyDisable: [],
    pluginsToDependencyInstall: [],
    sourceMismatches: [],
    ...fields,
  };
}

/**
 * D-PL2-16: `app`, held down by an earlier pass, declares `vault`, which `mp`
 * offers and the scope does not record; the config declares `app`.
 */
async function seedWaitingDependent(scope: ProjectScope): Promise<void> {
  await writeUnder(
    path.join(scope.marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "app", source: "./plugins/app", dependencies: ["vault"] },
        { name: "vault", source: "./plugins/vault" },
      ],
    }),
  );
  const seeded = recordedState(scope);
  const mp = seeded.marketplaces["mp"];
  assert.ok(mp !== undefined);
  await mkdir(scope.project.extensionRoot, { recursive: true });
  await saveState(scope.project.extensionRoot, {
    ...seeded,
    marketplaces: {
      mp: {
        ...mp,
        plugins: {
          app: {
            version: "1.0.0",
            resolvedSource: path.join(scope.marketplaceRoot, "plugins", "app"),
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            enabled: false,
            dependencyDisabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });
  await writeUnder(
    scope.project.baseConfigJsonPath,
    declaring({ mp: scope.marketplaceRoot }, { "app@mp": {} }),
  );
}

describe("readPassForScope", () => {
  test("plans exactly one replacement for a changed marketplace source", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "source-replacement");
    await seedRecordedState(scope);
    const replacement = path.join(scope.cwd, "replacement-mp");
    await writeUnder(scope.project.localConfigJsonPath, declaring({ mp: replacement }));

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.marketplacesToAdd, [
      { scope: "project", marketplace: "mp", source: replacement, configSource: "local" },
    ]);
  });

  test("WR-05: a scope with neither a state file nor a config returns no plan and creates nothing", async (t) => {
    // arrange
    const { cwd, project } = await createProjectScope(t, "pristine");

    // act
    const readResult = await readPassForScope(reader, "project", cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: undefined,
      invalidOutcomes: [],
    });
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
  });

  test("RECON-05: a readable scope returns its plan, verdict and snapshot and leaves state.json untouched", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "readable");
    await seedRecordedState(scope);
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ mp: scope.marketplaceRoot }, { "hello@mp": {} }),
    );
    const stateBytes = await readFile(scope.project.stateJsonPath, "utf8");
    const stateMtime = (await stat(scope.project.stateJsonPath)).mtimeMs;

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: planOf({
        pluginsToInstall: [
          { scope: "project", plugin: "hello", marketplace: "mp", configSource: "base" },
        ],
      }),
      invalidOutcomes: [],
      state: recordedState(scope),
      verdict: { ok: true, unsatisfied: [] },
    });
    assert.equal(await readFile(scope.project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(scope.project.stateJsonPath)).mtimeMs, stateMtime);
  });

  test("D-08 / D-21: a config that disables a dependency also plans the disable of its dependent", async (t) => {
    // arrange -- `app` declares `vault`, and the config now disables `vault`.
    const scope = await createProjectScope(t, "disabled-dependency");
    const manifestPath = path.join(scope.marketplaceRoot, ".claude-plugin", "marketplace.json");
    await writeUnder(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [
          { name: "app", source: "./plugins/app", dependencies: ["vault"] },
          { name: "vault", source: "./plugins/vault" },
        ],
      }),
    );
    const record = (plugin: string) => ({
      version: "1.0.0",
      resolvedSource: path.join(scope.marketplaceRoot, "plugins", plugin),
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled: true,
      provenance: "explicit" as const,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const seeded = recordedState(scope);
    const mp = seeded.marketplaces["mp"];
    assert.ok(mp !== undefined);
    const state: ExtensionState = {
      ...seeded,
      marketplaces: { mp: { ...mp, plugins: { app: record("app"), vault: record("vault") } } },
    };
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, state);
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ mp: scope.marketplaceRoot }, { "app@mp": {}, "vault@mp": { enabled: false } }),
    );

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(
      readResult.plan,
      planOf({
        pluginsToDisable: [{ scope: "project", plugin: "vault", marketplace: "mp" }],
        pluginsToDependencyDisable: [
          {
            scope: "project",
            plugin: "app",
            marketplace: "mp",
            dependency: "vault@mp",
            kind: "disabled",
          },
        ],
      }),
    );
    assert.deepStrictEqual(readResult.verdict, {
      ok: true,
      unsatisfied: [{ dependent: "app@mp", dependency: "vault@mp", kind: "disabled" }],
    });
  });

  test("APPLY1-01: a dependent held down for its dependency's version is enabled after the catalog moves that satisfy it", async (t) => {
    // arrange -- the catalog ships `app` 1.1.0 needing lib ^2.0.0 with `lib`
    // 2.0.0; `app` sits disabled by an earlier pass, both at 1.0.0.
    const scope = await createProjectScope(t, "deferred-enable");
    const manifestPath = path.join(scope.marketplaceRoot, ".claude-plugin", "marketplace.json");
    await writeUnder(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [
          {
            name: "app",
            source: "./plugins/app",
            version: "1.1.0",
            dependencies: [{ name: "lib", version: "^2.0.0" }],
          },
          { name: "lib", source: "./plugins/lib", version: "2.0.0" },
        ],
      }),
    );
    for (const manifest of [
      { name: "app", version: "1.1.0", dependencies: [{ name: "lib", version: "^2.0.0" }] },
      { name: "lib", version: "2.0.0" },
    ]) {
      await writeUnder(
        path.join(scope.marketplaceRoot, "plugins", manifest.name, ".claude-plugin", "plugin.json"),
        JSON.stringify(manifest),
      );
    }

    const record = (plugin: string, enabled: boolean) => ({
      version: "1.0.0",
      resolvedSource: path.join(scope.marketplaceRoot, "plugins", plugin),
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled,
      ...(!enabled && { dependencyDisabled: true }),
      provenance: "explicit" as const,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const seeded = recordedState(scope);
    const mp = seeded.marketplaces["mp"];
    assert.ok(mp !== undefined);
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, {
      ...seeded,
      marketplaces: {
        mp: { ...mp, plugins: { app: record("app", false), lib: record("lib", true) } },
        repair: { ...mp, name: "repair" },
      },
    });
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring(
        { mp: scope.marketplaceRoot, repair: "acme/replacement" },
        { "app@mp": {}, "lib@mp": {} },
      ),
    );

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(
      readResult.plan,
      planOf({
        marketplacesToAdd: [
          {
            scope: "project",
            marketplace: "repair",
            source: "acme/replacement",
            configSource: "base",
          },
        ],
        sourceMismatches: [
          {
            scope: "project",
            marketplace: "repair",
            cause: "source-mismatch",
            declaredSource: "acme/replacement",
            recordedSource: scope.marketplaceRoot,
          },
        ],
      }),
    );
    assert.deepStrictEqual(readResult.deferredEnables, [
      { scope: "project", plugin: "app", marketplace: "mp" },
    ]);
  });

  test("D-PL2-16: an enable that waits on a planned dependency install is carried apart from the plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "waiting-enable");
    await seedWaitingDependent(scope);

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.pluginsToEnable, []);
    assert.deepStrictEqual(readResult.plan.pluginsToDependencyDisable, []);
    assert.deepStrictEqual(
      readResult.plan.pluginsToDependencyInstall.map((op) => op.plugin),
      ["vault"],
    );
    assert.deepStrictEqual(readResult.enablesAfterInstalls, [
      { scope: "project", plugin: "app", marketplace: "mp" },
    ]);
  });

  test("MIG-01: a recorded scope with no config gains a base config built from its state before it plans", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "first-run");
    await seedRecordedState(scope);

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan, planOf({}));
    assert.deepStrictEqual(JSON.parse(await readFile(scope.project.baseConfigJsonPath, "utf8")), {
      schemaVersion: 1,
      marketplaces: { mp: { source: scope.marketplaceRoot } },
      plugins: {},
    });
  });

  test("S3: a refused first-run config write rejects with the base config's attribution", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "first-run-refused");
    await seedRecordedState(scope);
    await scope.setMode(scope.project.scopeRoot, 0o555);

    // act & assert
    await assert.rejects(
      () => readPassForScope(reader, "project", scope.cwd),
      (error: unknown) => {
        assert.ok(error instanceof MigrateConfigSaveError);
        assert.equal(error.configFilePath, scope.project.baseConfigJsonPath);
        assert.equal((error.cause as NodeJS.ErrnoException).code, "EACCES");
        return true;
      },
    );
  });

  test("CFG-03 / I5: an unreadable base config and an invalid local config each report a redacted row and no plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "invalid-config");
    await seedRecordedState(scope);
    await writeUnder(scope.project.baseConfigJsonPath, declaring({}));
    await scope.setMode(scope.project.baseConfigJsonPath, 0o000);
    await writeUnder(
      scope.project.localConfigJsonPath,
      JSON.stringify({ schemaVersion: 1, plugins: 7 }),
    );

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: undefined,
      invalidOutcomes: [
        {
          kind: "invalid-block",
          scope: "project",
          basename: "claude-plugins.json",
          reason: "invalid manifest",
          cause: new Error("read failed: EACCES: permission denied, open 'claude-plugins.json'"),
        },
        {
          kind: "invalid-block",
          scope: "project",
          basename: "claude-plugins.local.json",
          reason: "invalid manifest",
          cause: new Error("schema validation failed: /plugins: must be object"),
        },
      ],
    });
  });

  test("LAYER-06: each layer naming a marketplace only the other layer declares reports its gap and no plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "layer-gap");
    await seedRecordedState(scope);
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ mp: scope.marketplaceRoot }, { "lib@other": {} }),
    );
    await writeUnder(
      scope.project.localConfigJsonPath,
      declaring({ other: scope.marketplaceRoot }, { "hello@mp": {} }),
    );

    // act
    const readResult = await readPassForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: undefined,
      invalidOutcomes: [
        {
          kind: "layer-marketplace-gap",
          scope: "project",
          basename: "claude-plugins.json",
          cause: new Error(
            "The base config (claude-plugins.json) declares lib@other, but only the local config (claude-plugins.local.json) declares its marketplace. Run /claude:plugin marketplace add <source> --scope project with the source the local config declares, or remove the plugin from the base config.",
          ),
        },
        {
          kind: "layer-marketplace-gap",
          scope: "project",
          basename: "claude-plugins.local.json",
          cause: new Error(
            "The local config (claude-plugins.local.json) declares hello@mp, but only the base config (claude-plugins.json) declares its marketplace. Run /claude:plugin marketplace add <source> --local --scope project with the source the base config declares, or remove the plugin from the local config.",
          ),
        },
      ],
    });
  });
});

describe("readPlainPlanForScope", () => {
  test("WR-05: a scope with neither a state file nor a config returns no plan and creates nothing", async (t) => {
    // arrange
    const { cwd, project } = await createProjectScope(t, "plain-pristine");

    // act
    const readResult = await readPlainPlanForScope(reader, "project", cwd);

    // assert
    assert.deepStrictEqual(readResult, { plan: undefined, invalidOutcomes: [] });
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
  });

  test("CFG-03: an invalid config reports its row and no plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plain-invalid");
    await seedRecordedState(scope);
    await writeUnder(
      scope.project.baseConfigJsonPath,
      JSON.stringify({ schemaVersion: 1, plugins: 7 }),
    );

    // act
    const readResult = await readPlainPlanForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: undefined,
      invalidOutcomes: [
        {
          kind: "invalid-block",
          scope: "project",
          basename: "claude-plugins.json",
          reason: "invalid manifest",
          cause: new Error("schema validation failed: /plugins: must be object"),
        },
      ],
    });
  });

  test("D-PL6-19: a changed declared source is planned as a replacement add", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plain-source-replacement");
    await seedRecordedState(scope);
    const replacement = path.join(scope.cwd, "replacement-mp");
    await writeUnder(scope.project.localConfigJsonPath, declaring({ mp: replacement }));

    // act
    const readResult = await readPlainPlanForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.marketplacesToAdd, [
      {
        scope: "project",
        marketplace: "mp",
        source: replacement,
        configSource: "local",
      },
    ]);
    assert.deepStrictEqual(
      readResult.plan?.sourceMismatches.map((mismatch) => mismatch.cause),
      ["source-mismatch"],
    );
  });

  test("D-PL6-19: the official fallback declaration produces no repair or mismatch", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plain-official-fallback");
    const mp = recordedState(scope).marketplaces.mp;
    assert.ok(mp !== undefined);
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, {
      schemaVersion: 3,
      marketplaces: {
        "claude-plugins-official": {
          ...mp,
          name: "claude-plugins-official",
        },
      },
    });
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ "claude-plugins-official": "anthropics/claude-plugins-official" }),
    );

    // act
    const readResult = await readPlainPlanForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.marketplacesToAdd, []);
    assert.deepStrictEqual(readResult.plan?.sourceMismatches, []);
  });

  test("D-PL6-19: an unrecognized stored source remains report-only", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plain-unknown-source");
    const state = recordedState(scope);
    const mp = state.marketplaces.mp;
    assert.ok(mp !== undefined);
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await writeUnder(scope.project.baseConfigJsonPath, declaring({ mp: scope.marketplaceRoot }));
    const unknownReader: ReconcileStateReader = {
      loadState: () =>
        Promise.resolve({
          ...state,
          marketplaces: { mp: { ...mp, source: "opaque" } },
        }),
    };

    // act
    const readResult = await readPlainPlanForScope(unknownReader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.marketplacesToAdd, []);
    assert.deepStrictEqual(
      readResult.plan?.sourceMismatches.map((mismatch) => mismatch.cause),
      ["unknown-stored"],
    );
  });

  test("D-PL2-01: a planned dependency install does not count as landed, so the dependent waiting on it is not enabled", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "plain-waiting");
    await seedWaitingDependent(scope);

    // act
    const readResult = await readPlainPlanForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan?.pluginsToEnable, []);
    assert.deepStrictEqual(
      readResult.plan.pluginsToDependencyInstall.map((op) => op.plugin),
      ["vault"],
    );
    assert.equal(Object.hasOwn(readResult, "enablesAfterInstalls"), false);
    assert.deepStrictEqual(readResult.verdict, {
      ok: true,
      unsatisfied: [{ dependent: "app@mp", dependency: "vault@mp", kind: "missing" }],
    });
  });

  test("D-PL2-01: the plan is not settled against the catalog moves, so a dependent held for a version stays down", async (t) => {
    // arrange -- `app` 1.1.0 needs lib ^2.0.0 and ships with `lib` 2.0.0;
    // `app` sits disabled by an earlier pass, both at 1.0.0.
    const scope = await createProjectScope(t, "plain-unsettled");
    await writeUnder(
      path.join(scope.marketplaceRoot, ".claude-plugin", "marketplace.json"),
      JSON.stringify({
        name: "mp",
        plugins: [
          {
            name: "app",
            source: "./plugins/app",
            version: "1.1.0",
            dependencies: [{ name: "lib", version: "^2.0.0" }],
          },
          { name: "lib", source: "./plugins/lib", version: "2.0.0" },
        ],
      }),
    );
    const record = (plugin: string, enabled: boolean) => ({
      version: "1.0.0",
      resolvedSource: path.join(scope.marketplaceRoot, "plugins", plugin),
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
      enabled,
      ...(!enabled && { dependencyDisabled: true }),
      provenance: "explicit" as const,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const seeded = recordedState(scope);
    const mp = seeded.marketplaces["mp"];
    assert.ok(mp !== undefined);
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, {
      ...seeded,
      marketplaces: {
        mp: { ...mp, plugins: { app: record("app", false), lib: record("lib", true) } },
      },
    });
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ mp: scope.marketplaceRoot }, { "app@mp": {}, "lib@mp": {} }),
    );

    // act
    const readResult = await readPlainPlanForScope(reader, "project", scope.cwd);

    // assert
    assert.deepStrictEqual(readResult.plan, planOf({}));
    assert.equal(Object.hasOwn(readResult, "deferredEnables"), false);
  });
});

/** Fresh accumulators for one pass over both scopes. */
function accumulators(): ScopePassAccumulators {
  return { outcomes: [], migration: { rows: [], notices: [] } };
}

/** An MCP move step that records the input it is handed and does nothing. */
function recordingMove(inputs: McpMigrationInput[]): McpMigrationStep {
  return (input) => {
    inputs.push(input);
    return Promise.resolve();
  };
}

/**
 * The atomic writer names its temporary file `<basename>.<digits>` and an
 * EACCES message quotes that name, so the digits differ per run.
 */
function withoutTempSuffix(outcome: PerEntryOutcome): PerEntryOutcome {
  return outcome.kind === "invalid-block" && outcome.cause !== undefined
    ? {
        ...outcome,
        cause: new Error(outcome.cause.message.replaceAll(/\.json\.\d+/g, ".json.<tmp>")),
      }
    : outcome;
}

const LOCK_HELD_ROW: PerEntryOutcome = {
  kind: "invalid-block",
  scope: "project",
  basename: "state.json",
  reason: "lock held",
  cause: new Error(
    "Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.",
  ),
};

/** Hold the scope lock as another process would, for the rest of the case. */
async function holdScopeLock(t: TestContext, locations: ScopedLocations): Promise<void> {
  const release = await lockfile.lock(locations.extensionRoot, {
    lockfilePath: path.join(locations.extensionRoot, ".state-lock"),
    realpath: false,
  });
  t.after(() => release());
}

describe("openScopePass", () => {
  test("AMIG-01: a readable scope returns its read pass after the MCP move ran with its plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-readable");
    await seedRecordedState(scope);
    await writeUnder(
      scope.project.baseConfigJsonPath,
      declaring({ mp: scope.marketplaceRoot }, { "hello@mp": {} }),
    );
    const pass = accumulators();
    const moves: McpMigrationInput[] = [];
    const expectedPlan = planOf({
      pluginsToInstall: [
        { scope: "project", plugin: "hello", marketplace: "mp", configSource: "base" },
      ],
    });

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: recordingMove(moves),
    });

    // assert
    assert.deepStrictEqual(readResult?.plan, expectedPlan);
    assert.deepStrictEqual(moves, [
      {
        scope: "project",
        cwd: scope.cwd,
        plan: expectedPlan,
        rows: pass.migration.rows,
        notices: pass.migration.notices,
      },
    ]);
    assert.deepStrictEqual(pass.outcomes, []);
  });

  test("CFG-03 / AMIG-01: an invalid config stops the scope with its rows after the MCP move ran with no plan", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-invalid");
    await seedRecordedState(scope);
    await writeUnder(scope.project.baseConfigJsonPath, "{");
    const pass = accumulators();
    const moves: McpMigrationInput[] = [];

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: recordingMove(moves),
    });

    // assert
    assert.equal(readResult, undefined);
    assert.deepStrictEqual(pass.outcomes, [
      {
        kind: "invalid-block",
        scope: "project",
        basename: "claude-plugins.json",
        reason: "invalid manifest",
        cause: new Error(
          "JSON parse failed: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
        ),
      },
    ]);
    assert.deepStrictEqual(
      moves.map((move) => move.plan),
      [undefined],
    );
  });

  test("D-06: an invalid config's rows go to the caller's config outcomes, not the shared outcomes", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-invalid-apart");
    await seedRecordedState(scope);
    await writeUnder(scope.project.baseConfigJsonPath, "{");
    const pass = accumulators();
    const configOutcomes: PerEntryOutcome[] = [];

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: recordingMove([]),
      configOutcomes,
    });

    // assert
    assert.equal(readResult, undefined);
    assert.deepStrictEqual(pass.outcomes, []);
    assert.deepStrictEqual(
      configOutcomes.map((outcome) => outcome.kind),
      ["invalid-block"],
    );
  });

  test("S3: a refused first-run config write stops the scope with a row naming the base config and runs no MCP move", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-first-run-refused");
    await seedRecordedState(scope);
    await scope.setMode(scope.project.scopeRoot, 0o555);
    const pass = accumulators();
    const moves: McpMigrationInput[] = [];

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: recordingMove(moves),
    });

    // assert
    assert.equal(readResult, undefined);
    assert.deepStrictEqual(pass.outcomes.map(withoutTempSuffix), [
      {
        kind: "invalid-block",
        scope: "project",
        basename: "claude-plugins.json",
        reason: "permission denied",
        cause: new Error("EACCES: permission denied, open 'claude-plugins.json.<tmp>'"),
      },
    ]);
    assert.deepStrictEqual(moves, []);
  });

  test("WR-01: an unparseable state file stops the scope with a state.json row and runs no MCP move", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-unparseable");
    await writeUnder(scope.project.stateJsonPath, "{ not json");
    const pass = accumulators();
    const moves: McpMigrationInput[] = [];

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: recordingMove(moves),
    });

    // assert
    assert.equal(readResult, undefined);
    assert.deepStrictEqual(pass.outcomes, [
      {
        kind: "invalid-block",
        scope: "project",
        basename: "state.json",
        reason: "unparseable",
        cause: new Error(
          "state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 2 (line 1 column 3)",
        ),
      },
    ]);
    assert.deepStrictEqual(moves, []);
  });

  test("WR-01: a scope lock another process holds stops the scope with a lock-held row", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-lock-held");
    await seedRecordedState(scope);
    await holdScopeLock(t, scope.project);
    const pass = accumulators();

    // act
    const readResult = await openScopePass({ ...pass, reader, scope: "project", cwd: scope.cwd });

    // assert
    assert.equal(readResult, undefined);
    assert.deepStrictEqual(pass.outcomes, [LOCK_HELD_ROW]);
  });

  test("NFR-2: a throwing MCP move becomes a stopped row and the scope still opens", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-move-throws");
    await seedRecordedState(scope);
    await writeUnder(scope.project.baseConfigJsonPath, declaring({ mp: scope.marketplaceRoot }));
    const pass = accumulators();

    // act
    const readResult = await openScopePass({
      ...pass,
      reader,
      scope: "project",
      cwd: scope.cwd,
      migrateMcpEntries: () =>
        Promise.reject(new Error(`cannot read ${path.join(scope.cwd, ".pi", "mcp.json")}`)),
    });

    // assert
    assert.deepStrictEqual(readResult?.plan, planOf({}));
    assert.deepStrictEqual(pass.migration.rows, [
      { kind: "stopped", scope: "project", detail: "cannot read mcp.json" },
    ]);
    assert.deepStrictEqual(pass.outcomes, []);
  });

  test("AMIG-01: with no injected step the production move runs and finds nothing to move", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "open-production-move");
    await seedRecordedState(scope);
    await writeUnder(scope.project.baseConfigJsonPath, declaring({ mp: scope.marketplaceRoot }));
    const pass = accumulators();

    // act
    await openScopePass({ ...pass, reader, scope: "project", cwd: scope.cwd });

    // assert
    assert.deepStrictEqual(pass, accumulators());
    assert.deepStrictEqual(await loadState(scope.project.extensionRoot), recordedState(scope));
  });
});

describe("runScopeIsolated", () => {
  test("leaves the accumulated outcomes untouched when the operation completes", async () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
    ];

    // act
    await runScopeIsolated("project", outcomes, () => Promise.resolve());

    // assert
    assert.deepStrictEqual(outcomes, [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
    ]);
  });

  test("WR-02: appends a state.json row carrying the redacted cause when the operation throws", async () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [];

    // act
    await runScopeIsolated("user", outcomes, () =>
      Promise.reject(new Error("cannot write /home/someone/.pi/pi-claude-marketplace/state.json")),
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "invalid-block",
        scope: "user",
        basename: "state.json",
        reason: "unreadable",
        cause: new Error("cannot write state.json"),
      },
    ]);
  });
});

/** `state` whose `recorded` marketplace holds only the enabled plugin `plugin`. */
function withEnabledPlugin(
  state: ExtensionState,
  recorded: ExtensionState["marketplaces"][string],
  marketplaceRoot: string,
  plugin: string,
): ExtensionState {
  return {
    ...state,
    marketplaces: {
      [recorded.name]: {
        ...recorded,
        plugins: {
          [plugin]: {
            version: "1.0.0",
            resolvedSource: path.join(marketplaceRoot, "plugins", plugin),
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
}

describe("closeScopePass", () => {
  test("WR-05: a pristine scope reports nothing, skips the rebuild and creates nothing", async (t) => {
    // arrange
    const { cwd, project } = await createProjectScope(t, "close-pristine");
    const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
    const outcomes: PerEntryOutcome[] = [];

    // act
    await closeScopePass(
      "project",
      { plan: undefined, invalidOutcomes: [] },
      cwd,
      hooksRouting,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await retryTree(project.scopeRoot), []);
    verify(hooksRouting);
  });

  test("REC-05 / DLS-01 / DISP-02: reports the unreadable declarer, then the delisted plugin, then rebuilds under the lock", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "close-rows");
    const state = recordedState(scope);
    const recorded = state.marketplaces["mp"];
    assert.ok(recorded !== undefined);
    const delisted = withEnabledPlugin(state, recorded, scope.marketplaceRoot, "gone");
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, delisted);
    await writeUnder(recorded.manifestPath, JSON.stringify({ name: "mp", plugins: [] }));
    const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
    const lockHeldAtRebuild: boolean[] = [];
    when(() => hooksRouting.rebuildRoutingTables)
      .thenReturn(() => {
        lockHeldAtRebuild.push(existsSync(path.join(scope.project.extensionRoot, ".state-lock")));
      })
      .times(1);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await closeScopePass(
      "project",
      {
        plan: planOf({}),
        invalidOutcomes: [],
        state: delisted,
        verdict: {
          ok: false,
          declarer: "app@kit",
          reason: "unreadable manifest",
          cause: new Error("cannot read the dependencies of app@kit"),
        },
      },
      scope.cwd,
      hooksRouting,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-declarer-unreadable",
        scope: "project",
        marketplace: "kit",
        plugin: "app",
        reason: "unreadable manifest",
        cause: new Error("cannot read the dependencies of app@kit"),
      },
      {
        kind: "plugin-declarer-unreadable",
        scope: "project",
        marketplace: "mp",
        plugin: "gone",
        reason: "not in manifest",
        cause: new Error('Plugin "gone" not found in marketplace "mp"'),
      },
    ]);
    assert.deepStrictEqual(lockHeldAtRebuild, [true]);
    verify(hooksRouting);
  });

  test("D-PL5-28: reports a plugin of a refused marketplace before the delisted check, which then skips it", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "close-refused");
    const state = recordedState(scope);
    const recorded = state.marketplaces["mp"];
    assert.ok(recorded !== undefined);
    const refused = withEnabledPlugin(state, recorded, scope.marketplaceRoot, "gone");
    await mkdir(scope.project.extensionRoot, { recursive: true });
    await saveState(scope.project.extensionRoot, refused);
    await writeUnder(
      recorded.manifestPath,
      JSON.stringify({ name: "claude-plugins-v2", plugins: [] }),
    );
    const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
    when(() => hooksRouting.rebuildRoutingTables)
      .thenReturn(() => undefined)
      .times(1);
    const outcomes: PerEntryOutcome[] = [];

    // act
    await closeScopePass(
      "project",
      { plan: planOf({}), invalidOutcomes: [], state: refused },
      scope.cwd,
      hooksRouting,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-declarer-unreadable",
        scope: "project",
        marketplace: "mp",
        plugin: "gone",
        reason: "invalid manifest",
        cause: new Error(
          'Claude Code refuses the marketplace name "mp": it looks like one of Anthropic\'s own',
        ),
      },
    ]);
    verify(hooksRouting);
  });

  test("WR-01: a held scope lock turns the rebuild into a state.json row", async (t) => {
    // arrange
    const scope = await createProjectScope(t, "close-lock-held");
    await seedRecordedState(scope);
    await holdScopeLock(t, scope.project);
    const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
    const outcomes: PerEntryOutcome[] = [];

    // act
    await closeScopePass(
      "project",
      { plan: planOf({}), invalidOutcomes: [] },
      scope.cwd,
      hooksRouting,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [LOCK_HELD_ROW]);
    verify(hooksRouting);
  });
});

describe("notifyScopeOutcomes", () => {
  test("RECON-05: no outcome sends nothing", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const cascaded = notifyScopeOutcomes(ctx, runWithNothingLoaded(), []);

    // assert
    assert.equal(cascaded, false);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("IL-2: the outcomes go out as one cascade", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    const cascaded = notifyScopeOutcomes(ctx, runWithNothingLoaded(), [
      { kind: "mp-added", scope: "project", marketplace: "mp" },
    ]);

    // assert
    assert.equal(cascaded, true);
    assert.deepStrictEqual(notifications, [
      { message: "● mp [project] (added)\n\nReconcile: 1 success" },
    ]);
    verifyBoundary();
  });
});

describe("notifyScopePasses", () => {
  test("RECON-05: a pass with no outcome and no migration row stays silent", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);

    // act
    const cascaded = notifyScopePasses(ctx, runWithNothingLoaded(), accumulators());

    // assert
    assert.equal(cascaded, false);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
  });

  test("AMIG-03: a migration row with no outcome sends the migration notice alone", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const pass = accumulators();
    pass.migration.rows.push({
      kind: "moved",
      scope: "project",
      plugin: "hello",
      marketplace: "mp",
      from: "srv",
      to: "plugin_hello_srv_",
    });

    // act
    const cascaded = notifyScopePasses(ctx, runWithNothingLoaded(), pass);

    // assert
    assert.equal(cascaded, false);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.\n" +
          "\n" +
          "Moved to mcp-adapter.json:\n" +
          "  srv -> plugin_hello_srv_ (hello) [project]\n" +
          "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.\n" +
          "/reload to pick up changes",
        severity: "info",
      },
    ]);
    verifyBoundary();
  });

  test("IL-2: the outcomes of both scopes go out as one cascade, project first", () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const pass = accumulators();
    pass.outcomes.push(
      { kind: "mp-added", scope: "user", marketplace: "mp" },
      { kind: "mp-added", scope: "project", marketplace: "mp" },
    );

    // act
    const cascaded = notifyScopePasses(ctx, runWithNothingLoaded(), pass);

    // assert
    assert.equal(cascaded, true);
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp [project] (added)\n\n● mp [user] (added)\n\nReconcile: 2 successes",
      },
    ]);
    verifyBoundary();
  });
});
