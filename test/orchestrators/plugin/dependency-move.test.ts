import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  failedMoveRow,
  freshDependencyMoveMemos,
  judgeDependencyMove,
  runDependencyMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { DependencyMoveContext } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts";
import type {
  DependencyMoveRequest,
  PlannedDependencyMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type { MaterializationPolicy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

const UPDATE_POLICY = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: true,
} satisfies MaterializationPolicy;

function recordedPlugin(version: string, pluginRoot: string, enabled = true): PluginRecord {
  return {
    version,
    resolvedSource: pluginRoot,
    compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
    resources: {
      skills: ["zcore-tool"],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
      workflows: [],
    },
    enabled,
    provenance: "dependency",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Seeds a path marketplace `mp` offering `zcore` at `offered`, and a record of
 * `zcore` at `recorded`.
 */
async function seedDependency(
  t: TestContext,
  versions: { readonly recorded: string; readonly offered: string; readonly enabled?: boolean },
): Promise<{ readonly context: DependencyMoveContext; readonly pluginRoot: string }> {
  const { cwd } = await createHermeticEnvironment(t, "dependency-move-");
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "zcore");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "zcore", version: versions.offered }),
  );
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "zcore", source: "./plugins/zcore" }] }),
  );
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          zcore: recordedPlugin(versions.recorded, pluginRoot, versions.enabled ?? true),
        },
      },
    },
  });
  return {
    pluginRoot,
    context: {
      scope: "project",
      cwd,
      locations,
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache: createCompletionCache(),
      env: {},
      softDeps: runWithNothingLoaded().softDeps,
      policy: UPDATE_POLICY,
      cleanupClones: () => Promise.resolve(),
      ...freshDependencyMoveMemos(),
    },
  };
}

function request(overrides: Partial<DependencyMoveRequest> = {}): DependencyMoveRequest {
  return {
    key: "zcore@mp",
    name: "zcore",
    marketplace: "mp",
    recordedVersion: "1.0.0",
    requesters: [{ key: "widget@mp", ranges: ["^2.0.0"] }],
    ...overrides,
  };
}

function move(
  version: string,
  overrides: Partial<DependencyMoveRequest> = {},
): PlannedDependencyMove {
  return { request: request(overrides), version };
}

describe("freshDependencyMoveMemos", () => {
  test("allocates an empty memo pair on every call", () => {
    // act
    const first = freshDependencyMoveMemos();
    const second = freshDependencyMoveMemos();

    // assert
    assert.deepStrictEqual(first, {
      constraintTagMemo: new Map(),
      constraintMarketplaceTagMemo: new Map(),
    });
    assert.notStrictEqual(first.constraintTagMemo, second.constraintTagMemo);
  });
});

describe("judgeDependencyMove", () => {
  test("admits a move with the candidate it lands and writes nothing", async (t) => {
    // arrange
    const { context, pluginRoot } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
    });
    const stateBefore = await readFile(context.locations.stateJsonPath, "utf8");

    // act
    const judgement = await judgeDependencyMove(request(), context);

    // assert
    assert.deepStrictEqual(
      judgement.ok && [
        judgement.prepared.fromVersion,
        judgement.prepared.toVersion,
        judgement.prepared.installable.pluginRoot,
      ],
      ["1.0.0", "2.0.0", pluginRoot],
    );
    assert.strictEqual(await readFile(context.locations.stateJsonPath, "utf8"), stateBefore);
  });

  test("refuses a move whose catalog version falls outside the requester's range", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "1.5.0" });

    // act
    const judgement = await judgeDependencyMove(request(), context);

    // assert
    assert.deepStrictEqual(judgement, {
      ok: false,
      cause:
        'version 1.5.0 falls outside what the combined range admits (^2.0.0) -- required by "widget@mp"',
    });
  });

  test("refuses a move whose new version's names another plugin already owns", async (t) => {
    // arrange
    const { context, pluginRoot } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
    });
    const state = await loadState(context.locations.extensionRoot);
    const mp = state.marketplaces.mp;
    assert.ok(mp !== undefined);
    mp.plugins.other = recordedPlugin("1.0.0", pluginRoot);
    await saveState(context.locations.extensionRoot, state);

    // act
    const judgement = await judgeDependencyMove(request(), context);

    // assert
    assert.deepStrictEqual(judgement, {
      ok: false,
      cause: 'Cross-plugin name conflict:\n  - skill "zcore-tool" already owned by plugin "other"',
    });
  });

  test("refuses a dependency already at the newest version it can move to", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "2.0.0", offered: "2.0.0" });

    // act
    const judgement = await judgeDependencyMove(request({ recordedVersion: "2.0.0" }), context);

    // assert
    assert.deepStrictEqual(judgement, {
      ok: false,
      cause: "version 2.0.0 is the newest version it can move to",
    });
  });

  test("refuses a dependency the scope does not record with what the update found", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });

    // act
    const judgement = await judgeDependencyMove(
      request({ key: "absent@mp", name: "absent" }),
      context,
    );

    // assert
    assert.deepStrictEqual(judgement, { ok: false, cause: "not installed" });
  });

  test("refuses a move whose preflight throws with the error's message", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    await writeFile(context.locations.stateJsonPath, "{");

    // act
    const judgement = await judgeDependencyMove(request(), context);

    // assert
    assert.strictEqual(judgement.ok, false);
  });

  test("judges with the operation's flags and the command's context", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const notified: string[] = [];
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    const judgement = await judgeDependencyMove(request(), {
      ...context,
      partial: true,
      mapModel: true,
      notification: {
        ctx: { mode: "tui", ui: { notify: (message) => notified.push(message) } },
        run: runWithNothingLoaded(),
      },
      credentialOps: credentials.credentialOps,
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
      authMemo: new Map(),
    });

    // assert
    assert.strictEqual(judgement.ok, true);
    assert.deepStrictEqual(notified, []);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });
});

describe("runDependencyMove", () => {
  test("moves a dependency into range and reports its update row by its full key", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
    const { context, pluginRoot } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
    });

    // act
    const run = await runDependencyMove(move("2.0.0"), context);

    // assert
    assert.deepStrictEqual(run, {
      landed: true,
      rows: [
        {
          status: "updated",
          name: "zcore@mp",
          scope: "project",
          from: "1.0.0",
          to: "2.0.0",
          dependencies: [],
          reasons: ["dependency current copy"],
          cause: new Error('constrained to the combined range (^2.0.0) -- required by "widget@mp"'),
          severity: "info",
          needsReload: true,
        },
      ],
    });
    const state = await loadState(context.locations.extensionRoot);
    assert.deepStrictEqual(state.marketplaces.mp?.plugins.zcore, {
      ...recordedPlugin("2.0.0", pluginRoot),
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  test("fails a move whose candidate is not the version the plan chose and keeps the record", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const stateBefore = await readFile(context.locations.stateJsonPath, "utf8");

    // act
    const run = await runDependencyMove(move("2.1.0"), context);

    // assert
    assert.deepStrictEqual(run, {
      landed: false,
      rows: [
        {
          status: "failed",
          name: "zcore@mp",
          version: "1.0.0",
          reasons: [],
          cause: new Error("version 2.0.0 is not version 2.1.0, which the dependency plan chose"),
          severity: "error",
        },
      ],
    });
    assert.strictEqual(await readFile(context.locations.stateJsonPath, "utf8"), stateBefore);
  });

  test("moves a disabled dependency's pin and reports no row for it", async (t) => {
    // arrange
    const { context } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
      enabled: false,
    });

    // act
    const run = await runDependencyMove(move("2.0.0"), context);

    // assert
    assert.deepStrictEqual(run, { landed: true, rows: [] });
    const state = await loadState(context.locations.extensionRoot);
    assert.deepStrictEqual(
      [
        state.marketplaces.mp?.plugins.zcore?.version,
        state.marketplaces.mp?.plugins.zcore?.enabled,
      ],
      ["2.0.0", false],
    );
  });

  test("reports a dependency already at the planned version as landed with no row", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "2.0.0", offered: "2.0.0" });

    // act
    const run = await runDependencyMove(move("2.0.0", { recordedVersion: "2.0.0" }), context);

    // assert
    assert.deepStrictEqual(run, { landed: true, rows: [] });
  });

  test("reports a move that does not land as failed with what the update found", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "1.5.0" });

    // act
    const run = await runDependencyMove(move("1.5.0"), context);

    // assert
    assert.deepStrictEqual(run, {
      landed: false,
      rows: [
        {
          status: "failed",
          name: "zcore@mp",
          version: "1.0.0",
          reasons: ["dependents constrain"],
          cause: new Error(
            'version 1.5.0 falls outside what the combined range admits (^2.0.0) -- required by "widget@mp"',
          ),
          severity: "error",
        },
      ],
    });
  });

  test("reports a dependency the scope no longer records as a failed move at the version the plan read", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });

    // act
    const run = await runDependencyMove(
      move("2.0.0", { key: "absent@mp", name: "absent", recordedVersion: "1.1.0" }),
      context,
    );

    // assert
    assert.deepStrictEqual(run, {
      landed: false,
      rows: [
        {
          status: "failed",
          name: "absent@mp",
          version: "1.1.0",
          reasons: ["not installed"],
          cause: new Error("not installed"),
          severity: "error",
        },
      ],
    });
  });

  test("leaves a throw from the update runner to its caller", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const diskFull = new Error("disk full");

    // act & assert
    await assert.rejects(
      runDependencyMove(move("2.0.0"), {
        ...context,
        stateTransaction: { saveState: () => Promise.reject(diskFull) },
      }),
      diskFull,
    );
  });
});

describe("failedMoveRow", () => {
  test("reports a move that threw at the version it kept, its cause with every path redacted", () => {
    // act
    const row = failedMoveRow(
      request(),
      new Error("EACCES: permission denied, copyfile '/home/u/.pi/skills-staging/x/notes.md'"),
    );

    // assert
    assert.deepStrictEqual(row, {
      status: "failed",
      name: "zcore@mp",
      version: "1.0.0",
      reasons: [],
      cause: new Error("EACCES: permission denied, copyfile 'notes.md'"),
      severity: "error",
    });
  });

  test("reports a move that threw nothing as failed with an empty cause", () => {
    // act
    const row = failedMoveRow(request(), undefined);

    // assert
    assert.deepStrictEqual(row.status === "failed" && row.cause, new Error("undefined"));
  });
});
