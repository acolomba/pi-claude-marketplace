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
  notifyScopePasses,
  openScopePass,
  readPassForScope,
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
import type { ScopePassAccumulators } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts";
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

describe("readPassForScope", () => {
  test("WR-05: a scope with neither a state file nor a config returns no plan and creates nothing", async (t) => {
    // arrange
    const { cwd, project } = await createProjectScope(t, "pristine");

    // act
    const readResult = await readPassForScope(reader, "project", cwd);

    // assert
    assert.deepStrictEqual(readResult, {
      plan: undefined,
      invalidOutcomes: [],
      stateExisted: false,
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
      stateExisted: true,
      verdict: { ok: true, unsatisfied: [] },
    });
    assert.equal(await readFile(scope.project.stateJsonPath, "utf8"), stateBytes);
    assert.equal((await stat(scope.project.stateJsonPath)).mtimeMs, stateMtime);
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
      stateExisted: true,
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
      stateExisted: true,
    });
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

describe("closeScopePass", () => {
  test("WR-05: a pristine scope reports nothing, skips the rebuild and creates nothing", async (t) => {
    // arrange
    const { cwd, project } = await createProjectScope(t, "close-pristine");
    const hooksRouting = mock<InstallHooksRouting>({ exactParams: true, name: "hooks routing" });
    const outcomes: PerEntryOutcome[] = [];

    // act
    await closeScopePass(
      "project",
      { plan: undefined, invalidOutcomes: [], stateExisted: false },
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
    const delisted: ExtensionState = {
      ...state,
      marketplaces: {
        mp: {
          ...recorded,
          plugins: {
            gone: {
              version: "1.0.0",
              resolvedSource: path.join(scope.marketplaceRoot, "plugins", "gone"),
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
        stateExisted: true,
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
      { plan: planOf({}), invalidOutcomes: [], stateExisted: true },
      scope.cwd,
      hooksRouting,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [LOCK_HELD_ROW]);
    verify(hooksRouting);
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
