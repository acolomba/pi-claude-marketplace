import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { materializeLatestVersion } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { MaterializationPolicy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { ThreePhaseArgsBase } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

const UPDATE_POLICY = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
} satisfies MaterializationPolicy;

function recordedPlugin(version: string, pluginRoot: string): PluginRecord {
  return {
    version,
    resolvedSource: pluginRoot,
    compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
    resources: {
      skills: ["hello-tool"],
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
  };
}

/**
 * Seeds a path marketplace `mp` offering `hello` at `offered`, and a record
 * of `hello` at `recorded` whose `resolvedSource` is the real plugin root.
 */
async function seedRecordedPlugin(
  t: TestContext,
  versions: { readonly recorded: string; readonly offered: string },
): Promise<{ readonly base: ThreePhaseArgsBase; readonly pluginRoot: string }> {
  const { cwd } = await createHermeticEnvironment(t, "materialize-latest-");
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: versions.offered }),
  );
  await writeFile(path.join(pluginRoot, "skills", "tool", "SKILL.md"), "---\nname: tool\n---\n");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "hello", source: "./plugins/hello" }] }),
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
        plugins: { hello: recordedPlugin(versions.recorded, pluginRoot) },
      },
    },
  });
  return {
    pluginRoot,
    base: {
      plugin: "hello",
      marketplace: "mp",
      scope: "project",
      cwd,
      locations,
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache: createCompletionCache(),
      env: {},
      cleanupClones: () => Promise.resolve(),
    },
  };
}

test("returns the unchanged verdict for the recorded revision in direct mode", async (t) => {
  // arrange
  const { base } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const stateBefore = await readFile(base.locations.stateJsonPath, "utf8");
  const ctx: NotificationContext = {
    mode: "tui",
    ui: { notify: () => assert.fail("the unchanged verdict notifies nothing") },
  };

  // act
  const outcome = await materializeLatestVersion(
    {
      ...base,
      cascade: false,
      ctx,
      run: runWithNothingLoaded(),
      cardinality: "single",
      notifyPhaseFailure: () => assert.fail("the unchanged verdict stages nothing"),
    },
    UPDATE_POLICY,
  );

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "unchanged",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  assert.strictEqual(await readFile(base.locations.stateJsonPath, "utf8"), stateBefore);
});

test("swaps the offered version in and records it in cascade mode", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.1.0" });

  // act
  const outcome = await materializeLatestVersion({ ...base, cascade: true }, UPDATE_POLICY);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...recordedPlugin("1.1.0", pluginRoot),
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
});

test("REI-01: a policy that does not skip the recorded revision restores its deleted skill", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { base, pluginRoot } = await seedRecordedPlugin(t, { recorded: "1.0.0", offered: "1.0.0" });
  const reinstallPolicy = {
    refreshSource: false,
    skipSameRevision: false,
    overwrite: true,
  } satisfies MaterializationPolicy;

  // act
  const outcome = await materializeLatestVersion({ ...base, cascade: true }, reinstallPolicy);

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  assert.strictEqual(
    await readFile(path.join(base.locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
    '---\nname: hello-tool\ndescription: "No description provided."\n---\n',
  );
  const state = await loadState(base.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...recordedPlugin("1.0.0", pluginRoot),
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
});
