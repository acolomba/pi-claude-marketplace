import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

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
  withPlannedVersions,
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
import type {
  CascadeThreePhaseArgs,
  UpdateDependencySettler,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
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
    const settleDependencies: UpdateDependencySettler = () =>
      Promise.resolve({ kind: "settled", rows: [] });
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
      settleDependencies,
    });

    // assert
    assert.deepStrictEqual(context, {
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
      settleDependencies,
    });
  });

  test("binds no settle and no caller field the caller leaves unset", () => {
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
    assert.deepStrictEqual(context, {
      ...target,
      ...owners,
      policy: { ...INSTALL_MOVE_MATERIALIZATION, searchReleaseTags: false },
      softDeps: run.softDeps,
      notification: { ctx: CTX, run },
      ...memos,
    });
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
      updateArgs({ mapModel: true, partial: false, authMemo, ...commandAuth }),
      { ctx: CTX, run },
    );

    // assert
    assert.deepStrictEqual(caller, {
      ctx: CTX,
      run,
      mapModel: true,
      partial: false,
      authMemo,
      ...commandAuth,
    });
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

describe("withPlannedVersions", () => {
  test("shows each planned dependency at its planned version and leaves the snapshot alone", () => {
    // arrange
    const state = stateWith({ lib: pluginRecord("1.0.0"), other: pluginRecord("3.0.0") });

    // act
    const view = withPlannedVersions(state, new Map([["lib@mp", "2.0.0"]]));

    // assert
    assert.deepStrictEqual(
      view,
      stateWith({ lib: pluginRecord("2.0.0"), other: pluginRecord("3.0.0") }),
    );
    assert.deepStrictEqual(
      state,
      stateWith({ lib: pluginRecord("1.0.0"), other: pluginRecord("3.0.0") }),
    );
  });
});

describe("planCloneSweep", () => {
  test("removes the unreferenced clones created after it was taken and keeps the earlier ones", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "dependency-bindings-sweep-");
    const locations = locationsFor("project", cwd);
    await mkdir(path.join(locations.pluginClonesDir, "fetched"), { recursive: true });
    await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces: {} });
    const sweep = await planCloneSweep(locations);
    await mkdir(path.join(locations.pluginClonesDir, "planned"), { recursive: true });

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
});

describe("dependencyRefusal", () => {
  test("keeps only the failing dependency's row and the error naming it", () => {
    // act
    const refusal = dependencyRefusal({ rootKey: "widget@mp", scope: "project" })({
      kind: "constraint",
      failure: { kind: "no-matching-tag", key: "base@mp", range: "^3.0.0" },
    });

    // assert
    const cause = new DependencyCascadeError(
      'Dependency "base@mp" has no release tag satisfying ^3.0.0.',
      "base@mp",
    );
    assert.deepStrictEqual(refusal, {
      rows: [
        {
          status: "failed",
          name: "base@mp",
          reasons: ["no matching version"],
          cause,
          severity: "error",
          needsReload: false,
        },
      ],
      cause,
    });
  });
});
