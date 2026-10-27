import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  INSTALL_MOVE_MATERIALIZATION,
  RECONCILE_MOVE_MATERIALIZATION,
  dependencyMoveContext,
  dependencyRefusal,
  planCloneSweep,
  tagMemosOf,
  updateCaller,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts";
import { freshDependencyMoveMemos } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { DependencyCascadeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { DependencyCaller } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts";
import type { CascadeThreePhaseArgs } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

const CTX: NotificationContext = { mode: "tui", ui: { notify: () => undefined } };

/** The command's authentication collaborators, network disabled. */
function auth() {
  return {
    credentialOps: createCredentialOpsFake({ boundary: "memory" }).credentialOps,
    deviceFlowHttp: createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "device-1",
        user_code: "USER-1",
        verification_uri: "https://example.invalid/device",
        expires_in: 900,
        interval: 5,
      },
    }).http,
  };
}

function pluginRecord(version: string, resolvedSource = "/work/mp/plugins/p"): PluginRecord {
  return {
    version,
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
    enabled: true,
    provenance: "dependency",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A git-source record whose clone is `clone`. */
function gitRecord(clone: string): PluginRecord {
  return { ...pluginRecord("1.0.0", clone), resolvedSha: "a".repeat(40) };
}

function stateWith(plugins: Record<string, PluginRecord>): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp"),
        addedFromCwd: "/work",
        manifestPath: "/work/mp/.claude-plugin/marketplace.json",
        marketplaceRoot: "/work/mp",
        plugins,
      },
    },
  };
}

/** The update arguments a move runs with; only what the bindings read matters. */
function updateArgs(overrides: Partial<CascadeThreePhaseArgs> = {}): CascadeThreePhaseArgs {
  return {
    plugin: "zcore",
    marketplace: "mp",
    scope: "project",
    cwd: "/work",
    locations: locationsFor("project", "/work"),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    env: {},
    cascade: true,
    cleanupClones: () => Promise.resolve(),
    ...overrides,
  };
}

describe("dependencyMoveContext", () => {
  test("carries the target, the owners, the policy, the memos and every caller field set", () => {
    // arrange
    const owners = {
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache: createCompletionCache(),
      env: { HOME: "/home" },
    };
    const target = {
      scope: "project" as const,
      cwd: "/work",
      locations: locationsFor("project", "/work"),
    };
    const run = runWithNothingLoaded();
    const memos = freshDependencyMoveMemos();
    const authMemo = new Map<string, AuthAttemptResult>();
    const commandAuth = auth();
    const caller: DependencyCaller = {
      ctx: CTX,
      run,
      partial: true,
      mapModel: false,
      authMemo,
      ...commandAuth,
    };

    // act
    const context = dependencyMoveContext({
      owners,
      target,
      caller,
      policy: INSTALL_MOVE_MATERIALIZATION,
      memos,
    });

    // assert
    const { cleanupClones, ...carried } = context;
    assert.deepStrictEqual(carried, {
      ...target,
      ...owners,
      policy: INSTALL_MOVE_MATERIALIZATION,
      softDeps: run.softDeps,
      notification: { ctx: CTX, run },
      partial: true,
      mapModel: false,
      authMemo,
      ...commandAuth,
      ...memos,
    });
    assert.strictEqual(typeof cleanupClones, "function");
  });

  test("binds no caller field the caller leaves unset", () => {
    // arrange
    const owners = {
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache: createCompletionCache(),
      env: {},
    };
    const target = {
      scope: "user" as const,
      cwd: "/work",
      locations: locationsFor("user", "/work"),
    };
    const run = runWithNothingLoaded();
    const memos = freshDependencyMoveMemos();

    // act
    const context = dependencyMoveContext({
      owners,
      target,
      caller: { ctx: CTX, run },
      policy: RECONCILE_MOVE_MATERIALIZATION,
      memos,
    });

    // assert
    const { cleanupClones: _cleanup, ...carried } = context;
    assert.deepStrictEqual(carried, {
      ...target,
      ...owners,
      policy: { ...INSTALL_MOVE_MATERIALIZATION, searchReleaseTags: false },
      softDeps: run.softDeps,
      notification: { ctx: CTX, run },
      ...memos,
    });
  });

  test("IN-N4: a move collects no clone, leaving it to the operation's sweep", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-keep-");
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces: {} });
    await mkdir(path.join(locations.pluginClonesDir, "replaced"), { recursive: true });
    const context = dependencyMoveContext({
      owners: {
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
        env: {},
      },
      target: { scope: "project", cwd, locations },
      caller: { ctx: CTX, run: runWithNothingLoaded() },
      policy: INSTALL_MOVE_MATERIALIZATION,
      memos: freshDependencyMoveMemos(),
    });

    // act
    await context.cleanupClones(locations);

    // assert
    assert.deepStrictEqual(await readdir(locations.pluginClonesDir), ["replaced"]);
  });
});

describe("tagMemosOf", () => {
  test("keeps the update's own memo pair", () => {
    // arrange
    const own = freshDependencyMoveMemos();
    const args = updateArgs({
      constraintTagMemo: own.constraintTagMemo,
      constraintMarketplaceTagMemo: own.constraintMarketplaceTagMemo,
    });

    // act
    const memos = tagMemosOf(args, freshDependencyMoveMemos());

    // assert
    assert.strictEqual(memos.constraintTagMemo, own.constraintTagMemo);
    assert.strictEqual(memos.constraintMarketplaceTagMemo, own.constraintMarketplaceTagMemo);
  });

  test("uses the fresh pair for an update that has none", () => {
    // arrange
    const fresh = freshDependencyMoveMemos();

    // act
    const memos = tagMemosOf(updateArgs(), fresh);

    // assert
    assert.strictEqual(memos.constraintTagMemo, fresh.constraintTagMemo);
    assert.strictEqual(memos.constraintMarketplaceTagMemo, fresh.constraintMarketplaceTagMemo);
  });
});

describe("updateCaller", () => {
  test("carries the notification and every caller field the update sets", () => {
    // arrange
    const run = runWithNothingLoaded();
    const authMemo = new Map<string, AuthAttemptResult>();
    const commandAuth = auth();

    // act
    const caller = updateCaller(
      {
        plugin: "zcore",
        marketplace: "mp",
        scope: "project",
        cwd: "/work",
        locations: locationsFor("project", "/work"),
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
        env: {},
        cleanupClones: () => Promise.resolve(),
        mapModel: true,
        partial: true,
        authMemo,
        ...commandAuth,
        cascade: false,
        ctx: CTX,
        run,
        cardinality: "single",
        notifyPhaseFailure: () => undefined,
      },
      { ctx: CTX, run },
    );

    // assert
    assert.deepStrictEqual(caller, {
      ctx: CTX,
      run,
      mapModel: true,
      partial: true,
      authMemo,
      ...commandAuth,
    });
  });

  test("WR-N3: leaves out the in-place degrade a cascade-mode update carries as partial", () => {
    // arrange
    const run = runWithNothingLoaded();

    // act
    const caller = updateCaller(updateArgs({ partial: true, mapModel: false }), { ctx: CTX, run });

    // assert
    assert.deepStrictEqual(caller, { ctx: CTX, run, mapModel: false });
  });

  test("carries only the notification when the update sets no caller field", () => {
    // arrange
    const run = runWithNothingLoaded();

    // act
    const caller = updateCaller(updateArgs(), { ctx: CTX, run });

    // assert
    assert.deepStrictEqual(caller, { ctx: CTX, run });
  });
});

function holdStateLock(locations: ScopedLocations): Promise<() => Promise<void>> {
  return lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });
}

describe("planCloneSweep", () => {
  test("UPD-DEP-D1 / IN-N4: removes the clones the operation left unreferenced and keeps the ones unreferenced before it", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-");
    const locations = locationsFor("project", cwd);
    const live = path.join(locations.pluginClonesDir, "111111111111-aaaaaaaaaaaa");
    await mkdir(path.join(locations.pluginClonesDir, "fetched"), { recursive: true });
    await mkdir(live, { recursive: true });
    await saveState(locations.extensionRoot, stateWith({ lib: gitRecord(live) }));
    const sweep = await planCloneSweep(locations);
    await mkdir(path.join(locations.pluginClonesDir, "planned"), { recursive: true });
    await saveState(locations.extensionRoot, stateWith({}));

    // act
    await sweep();

    // assert
    assert.deepStrictEqual(await readdir(locations.pluginClonesDir), ["fetched"]);
  });

  test("does not throw when the clones cannot be read", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-fail-");
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces: {} });
    const sweep = await planCloneSweep(locations);
    await rm(locations.pluginClonesDir, { recursive: true, force: true });
    await writeFile(locations.pluginClonesDir, "not a directory");

    // act & assert
    await assert.doesNotReject(sweep());
  });

  test("IN-N5: removes nothing when the clones cannot be listed before the plan", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-list-");
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces: {} });
    await writeFile(locations.pluginClonesDir, "not a directory");
    const sweep = await planCloneSweep(locations);
    await rm(locations.pluginClonesDir, { force: true });
    await mkdir(path.join(locations.pluginClonesDir, "planned"), { recursive: true });

    // act
    await sweep();

    // assert
    assert.deepStrictEqual(await readdir(locations.pluginClonesDir), ["planned"]);
  });

  test("GLK-03 / D-PL7-13: a scope lock held while the clones are listed makes the sweep remove nothing", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-held-list-");
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, stateWith({}));
    await mkdir(path.join(locations.pluginClonesDir, "fetched"), { recursive: true });
    const release = await holdStateLock(locations);
    let sweep: () => Promise<void>;
    try {
      sweep = await planCloneSweep(locations);
    } finally {
      await release();
    }

    await mkdir(path.join(locations.pluginClonesDir, "planned"), { recursive: true });

    // act
    await sweep();

    // assert
    assert.deepStrictEqual((await readdir(locations.pluginClonesDir)).sort(), [
      "fetched",
      "planned",
    ]);
  });

  test("GLK-03 / D-PL7-05: a scope lock held while the sweep runs leaves every clone and the sweep resolves", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-held-sweep-");
    const locations = locationsFor("project", cwd);
    await saveState(locations.extensionRoot, stateWith({}));
    await mkdir(path.join(locations.pluginClonesDir, "fetched"), { recursive: true });
    const sweep = await planCloneSweep(locations);
    await mkdir(path.join(locations.pluginClonesDir, "planned"), { recursive: true });
    const release = await holdStateLock(locations);

    // act
    try {
      await sweep();
    } finally {
      await release();
    }

    // assert
    assert.deepStrictEqual((await readdir(locations.pluginClonesDir)).sort(), [
      "fetched",
      "planned",
    ]);
  });
});

describe("dependencyRefusal", () => {
  test("keeps only the failing dependency's row and a typed error naming it", () => {
    // act
    const refusal = dependencyRefusal({ rootKey: "widget@mp", scope: "project" })({
      kind: "constraint",
      failure: { kind: "no-matching-tag", key: "base@mp", range: "^3.0.0" },
    });

    // assert
    assert.ok(refusal.cause instanceof DependencyCascadeError);
    assert.deepStrictEqual(
      {
        rows: refusal.rows.map((row) => ({
          ...row,
          cause:
            row.status !== "failed" || row.cause === undefined
              ? undefined
              : { name: row.cause.name, message: row.cause.message },
        })),
        cause: { message: refusal.cause.message, key: refusal.cause.key },
      },
      {
        rows: [
          {
            status: "failed",
            name: "base@mp",
            reasons: ["no matching version"],
            cause: {
              name: "Error",
              message: 'Dependency "base@mp" has no release tag satisfying ^3.0.0.',
            },
            severity: "error",
            needsReload: false,
          },
        ],
        cause: {
          message: 'Dependency "base@mp" has no release tag satisfying ^3.0.0.',
          key: "base@mp",
        },
      },
    );
  });
});
