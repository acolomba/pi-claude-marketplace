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
  freshDependencyMoveMemos,
  judgeDependencyMoves,
  runDependencyMoves,
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
import type { OutOfRangeMember } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type { UpdateDependencyRow } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

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
      ...freshDependencyMoveMemos(),
    },
  };
}

function outOfRange(overrides: Partial<OutOfRangeMember> = {}): OutOfRangeMember {
  return {
    key: "zcore@mp",
    name: "zcore",
    marketplace: "mp",
    requiredBy: "widget@mp",
    ranges: ["^2.0.0"],
    range: "^2.0.0",
    recordedVersion: "1.0.0",
    ...overrides,
  };
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

describe("judgeDependencyMoves", () => {
  test("admits a move whose catalog version satisfies the requester's range and writes nothing", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const stateBefore = await readFile(context.locations.stateJsonPath, "utf8");

    // act
    const judgement = await judgeDependencyMoves([outOfRange()], context);

    // assert
    assert.deepStrictEqual(judgement, { ok: true });
    assert.strictEqual(await readFile(context.locations.stateJsonPath, "utf8"), stateBefore);
  });

  test("refuses a move whose catalog version falls outside the requester's range", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "1.5.0" });
    const member = outOfRange();

    // act
    const judgement = await judgeDependencyMoves([member], context);

    // assert
    assert.deepStrictEqual(judgement, {
      ok: false,
      member,
      cause:
        'version 1.5.0 falls outside what the combined range admits (^2.0.0) -- required by "widget@mp"',
    });
  });

  test("refuses a dependency already at the newest version it can move to", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "2.0.0", offered: "2.0.0" });
    const member = outOfRange({ recordedVersion: "2.0.0" });

    // act
    const judgement = await judgeDependencyMoves([member], context);

    // assert
    assert.deepStrictEqual(judgement, {
      ok: false,
      member,
      cause: "version 2.0.0 is the newest version it can move to",
    });
  });

  test("refuses a dependency the scope does not record with what the update found", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const member = outOfRange({ key: "absent@mp", name: "absent" });

    // act
    const judgement = await judgeDependencyMoves([member], context);

    // assert
    assert.deepStrictEqual(judgement, { ok: false, member, cause: "not installed" });
  });
});

describe("runDependencyMoves", () => {
  test("moves a dependency into range and reports its update row by its full key", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
    const { context, pluginRoot } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
    });

    // act
    const result = await runDependencyMoves([outOfRange()], context);

    // assert
    assert.deepStrictEqual(result, {
      ok: true,
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

  test("moves a disabled dependency's pin and reports no row for it", async (t) => {
    // arrange
    const { context } = await seedDependency(t, {
      recorded: "1.0.0",
      offered: "2.0.0",
      enabled: false,
    });

    // act
    const result = await runDependencyMoves([outOfRange()], context);

    // assert
    assert.deepStrictEqual(result, { ok: true, rows: [] });
    const state = await loadState(context.locations.extensionRoot);
    assert.deepStrictEqual(
      [
        state.marketplaces.mp?.plugins.zcore?.version,
        state.marketplaces.mp?.plugins.zcore?.enabled,
      ],
      ["2.0.0", false],
    );
  });

  test("stops at a move that does not land and reports it failed with what the update found", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "1.5.0" });
    const member = outOfRange();

    // act
    const result = await runDependencyMoves([member, outOfRange({ key: "next@mp" })], context);

    // assert
    assert.deepStrictEqual(result, {
      ok: false,
      member,
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

  test("reports a dependency already at its newest version as a failed move", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "2.0.0", offered: "2.0.0" });
    const member = outOfRange({ recordedVersion: "2.0.0" });

    // act
    const result = await runDependencyMoves([member], context);

    // assert
    assert.deepStrictEqual(result, {
      ok: false,
      member,
      rows: [
        {
          status: "failed",
          name: "zcore@mp",
          version: "2.0.0",
          reasons: [],
          cause: new Error("version 2.0.0 is the newest version it can move to"),
          severity: "error",
        },
      ],
    });
  });

  test("reports a move whose runner throws as failed with the thrown error", async (t) => {
    // arrange
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const diskFull = new Error("disk full");
    const member = outOfRange();

    // act
    const result = await runDependencyMoves([member], {
      ...context,
      stateTransaction: { saveState: () => Promise.reject(diskFull) },
    });

    // assert
    assert.deepStrictEqual(result, {
      ok: false,
      member,
      rows: [
        {
          status: "failed",
          name: "zcore@mp",
          version: "1.0.0",
          reasons: [],
          cause: diskFull,
          severity: "error",
        },
      ],
    });
  });

  test("threads the operation's collaborators into each move and reports the moved dependency's own closure", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
    const { context } = await seedDependency(t, { recorded: "1.0.0", offered: "2.0.0" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const deviceFlow = createDeviceFlowFake({
      boundary: "memory",
      network: "disabled",
      deviceCode: {
        device_code: "device-1",
        user_code: "USER-1",
        verification_uri: "https://example.invalid/device",
        expires_in: 900,
        interval: 5,
      },
    });
    const nested = {
      status: "installed",
      name: "base@mp",
      dependencies: [],
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    } satisfies UpdateDependencyRow;
    const settledFor: string[] = [];

    // act
    const result = await runDependencyMoves([outOfRange()], {
      ...context,
      credentialOps: credentials.credentialOps,
      deviceFlowHttp: deviceFlow.http,
      authMemo: new Map(),
      settleDependencies: (args) => {
        settledFor.push(`${args.plugin}@${args.marketplace}`);
        return Promise.resolve({ kind: "settled", rows: [nested] });
      },
    });

    // assert
    assert.deepStrictEqual(
      result.rows.map((row) => [row.status, row.name]),
      [
        ["updated", "zcore@mp"],
        ["installed", "base@mp"],
      ],
    );
    assert.deepStrictEqual(settledFor, ["zcore@mp"]);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(deviceFlow.calls, { requestCode: [], pollToken: [] });
  });
});
