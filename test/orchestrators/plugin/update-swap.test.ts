import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { preparePluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { swapPluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { PluginUpdateConcurrencyError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

// The flow suite supplies the real bridge, filesystem, rollback, and
// state-ledger fixtures while this mirrored owner pair proves they execute
// through the extracted swap module.
import { seedPathMarketplace, withHermeticHome } from "./update-flow.test.ts";

import type { MaterializationPolicy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type {
  DirectThreePhaseArgs,
  ThreePhaseArgsBase,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import type { TestContext } from "node:test";

/** `update`'s knobs on the shared runner (D-18-04). */
const UPDATE_POLICY = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: true,
} satisfies MaterializationPolicy;

// D-18-04: a caller names its verb's policy; omitting it does not compile.
void (true satisfies undefined extends Parameters<typeof swapPluginUpdate>[2] ? false : true);

/**
 * Seed a legacy pre-migration agent target, its index row, an unrelated
 * owned agent that must survive untouched, and the installed record the
 * migration reads. Shared by every AGENT-01 update case below so each one
 * states only the behavior it drives, not this fixture.
 */
async function seedLegacyAgentUpdate(t: TestContext, coexist: boolean) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const cwd = await mkdtemp(path.join(tmpdir(), "update-agent-migration-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const marketplaceRoot = path.join(cwd, "mp-src");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    manifestPlugins: {
      hello: {
        version: "2.0.0",
        hasSkill: false,
        agents: [
          {
            sourceName: "hello-reviewer",
            description: "Prefixed reviewer",
            body: "Prefixed body.\n",
          },
          ...(coexist
            ? [{ sourceName: "reviewer", description: "Reviewer", body: "Short body.\n" }]
            : []),
        ],
      },
    },
    installedVersions: { hello: "1.0.0" },
  });
  const locations = locationsFor("project", cwd);
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  const sourcePath = path.join(pluginRoot, "agents", "hello-reviewer.md");
  const oldTarget = path.join(locations.agentsDir, "pi-claude-marketplace-hello-reviewer.md");
  const newTarget = path.join(locations.agentsDir, "pi-claude-marketplace-hello-hello-reviewer.md");
  const otherTarget = path.join(locations.agentsDir, "pi-claude-marketplace-world-sentinel.md");
  const oldBytes = `---\nname: pi-claude-marketplace-hello-reviewer\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: hello-reviewer\n  sourcePath: ${sourcePath}\n---\n\nLegacy body.\n`;
  await mkdir(locations.agentsDir, { recursive: true });
  await writeFile(oldTarget, oldBytes);
  await writeFile(otherTarget, "Other owner's sentinel.\n");
  const otherEntry = {
    plugin: "world",
    marketplace: "other",
    sourceAgent: "sentinel",
    generatedName: "pi-claude-marketplace-world-sentinel",
    sourcePath: otherTarget,
    targetPath: otherTarget,
    sourceHash: "b".repeat(64),
    droppedFields: [],
    droppedTools: [],
    warnings: [],
  };
  const oldIndex = {
    schemaVersion: 1,
    agents: [
      otherEntry,
      {
        plugin: "hello",
        marketplace: "mp",
        sourceAgent: "hello-reviewer",
        generatedName: "pi-claude-marketplace-hello-reviewer",
        sourcePath,
        targetPath: oldTarget,
        sourceHash: "a".repeat(64),
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  };
  const oldIndexBytes = JSON.stringify(oldIndex);
  await writeFile(locations.agentsIndexPath, oldIndexBytes);
  const beforeState = await loadState(locations.extensionRoot);
  const oldRecord = beforeState.marketplaces.mp?.plugins.hello;
  assert.ok(oldRecord);
  oldRecord.resources = {
    skills: [],
    prompts: [],
    agents: ["pi-claude-marketplace-hello-reviewer"],
    workflows: [],
    mcpServers: [],
    hooks: [],
  };
  await saveState(locations.extensionRoot, beforeState);
  const options = {
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    cwd,
    locations,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    env: {},
    cascade: true,
    cleanupClones: () => Promise.resolve(),
  } as const;
  return {
    locations,
    pluginRoot,
    oldTarget,
    newTarget,
    otherTarget,
    oldBytes,
    oldIndexBytes,
    otherEntry,
    oldRecord,
    options,
  };
}

/**
 * Assert a successful AGENT-01 migration: the staged names, the regenerated
 * agent bytes, the rebuilt index, the untouched foreign entry, and the
 * updated install record. Shared by every case that reaches a successful
 * swap, whether on the first attempt or after a retry.
 */
async function assertAgentsMigrated(params: {
  readonly outcome: Awaited<ReturnType<typeof swapPluginUpdate>>;
  readonly coexist: boolean;
  readonly fixture: Awaited<ReturnType<typeof seedLegacyAgentUpdate>>;
}): Promise<void> {
  const { outcome, coexist, fixture } = params;
  const { locations, pluginRoot, oldTarget, otherTarget, otherEntry, oldRecord } = fixture;
  const expectedNames = coexist
    ? ["pi-claude-marketplace-hello-hello-reviewer", "pi-claude-marketplace-hello-reviewer"]
    : ["pi-claude-marketplace-hello-hello-reviewer"];
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    stagedAgentNames: expectedNames,
    stagedMcpServerNames: [],
    declaresAgents: true,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  const expectedAgents = [
    {
      sourceName: "hello-reviewer",
      generatedName: "pi-claude-marketplace-hello-hello-reviewer",
      description: "Prefixed reviewer",
      body: "Prefixed body.\n",
    },
    ...(coexist
      ? [
          {
            sourceName: "reviewer",
            generatedName: "pi-claude-marketplace-hello-reviewer",
            description: "Reviewer",
            body: "Short body.\n",
          },
        ]
      : []),
  ];
  const expectedEntries = [otherEntry];
  for (const agent of expectedAgents) {
    const agentSourcePath = path.join(pluginRoot, "agents", agent.sourceName + ".md");
    const targetPath = path.join(locations.agentsDir, agent.generatedName + ".md");
    const sourceBytes = `---\nname: ${agent.sourceName}\ndescription: ${agent.description}\ntools: Read,Grep\n---\n\n${agent.body}`;
    expectedEntries.push({
      plugin: "hello",
      marketplace: "mp",
      sourceAgent: agent.sourceName,
      generatedName: agent.generatedName,
      sourcePath: agentSourcePath,
      targetPath,
      sourceHash: createHash("sha256").update(sourceBytes).digest("hex"),
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    });
    assert.strictEqual(
      await readFile(targetPath, "utf8"),
      `---\nname: hello:${agent.sourceName}\ndescription: ${agent.description}\naliases: ${agent.generatedName}\ntools: read,grep\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: ${agent.sourceName}\n  sourcePath: ${agentSourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\n${agent.body}`,
    );
  }

  assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
    schemaVersion: 1,
    agents: expectedEntries,
  });
  assert.strictEqual(await readFile(otherTarget, "utf8"), "Other owner's sentinel.\n");
  const state = await loadState(locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...oldRecord,
    version: "2.0.0",
    resolvedSource: pluginRoot,
    compatibility: { installable: true, notes: [], supported: ["agents"], unsupported: [] },
    resources: {
      skills: [],
      prompts: [],
      agents: expectedNames,
      mcpServers: [],
      hooks: [],
      workflows: [],
    },
    updatedAt: "2026-01-02T00:00:00.001Z",
  });
  if (!coexist) {
    await assert.rejects(readFile(oldTarget), { code: "ENOENT" });
  }
}

for (const scenario of ["prefixed", "coexistence"] as const) {
  test(`AGENT-01: update migrates legacy agents for ${scenario}`, async (t) => {
    await withHermeticHome(async () => {
      // arrange
      const coexist = scenario === "coexistence";
      const fixture = await seedLegacyAgentUpdate(t, coexist);
      const preflight = await preparePluginUpdate({ ...fixture.options, policy: UPDATE_POLICY });
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(fixture.options, preflight, UPDATE_POLICY);

      // assert
      await assertAgentsMigrated({ outcome, coexist, fixture });
    });
  });
}

test("AGENT-01 / NFR-3: update refuses an occupied agent target before its intent mark and the retry migrates once it is freed", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const fixture = await seedLegacyAgentUpdate(t, false);
    const { locations, newTarget, oldTarget, oldBytes, oldIndexBytes, options } = fixture;
    const preflight = await preparePluginUpdate({ ...options, policy: UPDATE_POLICY });
    assert.ok(!("partition" in preflight));
    await writeFile(newTarget, "Foreign new target.\n");
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");

    // act & assert
    await assert.rejects(swapPluginUpdate(options, preflight, UPDATE_POLICY), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message, cause: error.cause },
        {
          name: "Error",
          message: `Cannot replace agent target with non-previous content at ${newTarget}`,
          cause: undefined,
        },
      );
      return true;
    });
    assert.strictEqual(await readFile(oldTarget, "utf8"), oldBytes);
    assert.strictEqual(await readFile(newTarget, "utf8"), "Foreign new target.\n");
    assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), oldIndexBytes);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);

    // arrange: the occupying file is gone, so the retry can replace it
    await rm(newTarget);
    const retryPreflight = await preparePluginUpdate({ ...options, policy: UPDATE_POLICY });
    assert.ok(!("partition" in retryPreflight));

    // act
    const outcome = await swapPluginUpdate(options, retryPreflight, UPDATE_POLICY);

    // assert
    await assertAgentsMigrated({ outcome, coexist: false, fixture });
  });
});

/** Cascade-mode swap arguments for `hello@mp` in the project scope of `cwd`. */
function cascadeSwapArgs(cwd: string): ThreePhaseArgsBase & { readonly cascade: true } {
  return {
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    cwd,
    locations: locationsFor("project", cwd),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    env: {},
    cascade: true,
    cleanupClones: () => Promise.resolve(),
  };
}

test("D-18-06: a partially available candidate's swap records the plugin as not installable with its dropped kinds", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { cwd } = await createHermeticEnvironment(t, "update-swap-partial-");
  const marketplaceRoot = path.join(cwd, "mp-src");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
    installedVersions: { hello: "1.0.0" },
  });
  await mkdir(path.join(marketplaceRoot, "plugins", "hello", "themes"), { recursive: true });
  const args = cascadeSwapArgs(cwd);
  const preflight = await preparePluginUpdate({ policy: UPDATE_POLICY, ...args, partial: true });
  assert.ok(!("partition" in preflight));

  // act
  const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

  // assert
  assert.strictEqual(outcome.partition, "updated");
  const state = await loadState(args.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.compatibility, {
    installable: false,
    notes: ["contains themes"],
    supported: ["skills"],
    unsupported: ["themes"],
  });
});

/** Same-revision knobs (a reinstall's): neither the version nor the sha moves. */
const SAME_REVISION_POLICY = {
  refreshSource: false,
  skipSameRevision: false,
  overwrite: true,
  searchReleaseTags: true,
} satisfies MaterializationPolicy;

/** A `saveState` that lets the intent mark through and refuses the finalize save. */
function refuseFinalizeSave(): typeof saveState {
  let saves = 0;
  return async (extensionRoot, state) => {
    saves += 1;
    if (saves === 2) {
      throw new Error("finalize refused");
    }

    await saveState(extensionRoot, state);
  };
}

/** Seeds `hello` 1.0.0 installed at 1.0.0, recorded with `updatedAt`. */
async function seedSameRevisionUpdate(t: TestContext, prefix: string, updatedAt: string) {
  const { cwd } = await createHermeticEnvironment(t, prefix);
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const args = cascadeSwapArgs(cwd);
  const state = await loadState(args.locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record);
  record.updatedAt = updatedAt;
  await saveState(args.locations.extensionRoot, state);
  return args;
}

test("ST-9: a same-revision swap prepared before another swap's intent mark fails concurrently updated and a fresh run converges", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "update-swap-overlap-");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const args = cascadeSwapArgs(cwd);
  const policy = SAME_REVISION_POLICY;
  const first = await preparePluginUpdate({ ...args, policy });
  const second = await preparePluginUpdate({ ...args, policy });
  assert.ok(!("partition" in first));
  assert.ok(!("partition" in second));
  const firstOutcome = await swapPluginUpdate(
    { ...args, stateTransaction: { saveState: refuseFinalizeSave() } },
    first,
    policy,
  );
  assert.strictEqual(firstOutcome.partition, "failed");
  const markedState = await readFile(args.locations.stateJsonPath, "utf8");

  // act & assert
  await assert.rejects(swapPluginUpdate(args, second, policy), (error: unknown) => {
    assert.ok(error instanceof PluginUpdateConcurrencyError);
    assert.deepStrictEqual(
      {
        kind: error.kind,
        plugin: error.plugin,
        marketplace: error.marketplace,
        lifecycle: error.lifecycle,
      },
      { kind: "plugin-updated", plugin: "hello", marketplace: "mp", lifecycle: "intent" },
    );
    return true;
  });
  assert.strictEqual(await readFile(args.locations.stateJsonPath, "utf8"), markedState);

  // arrange: a run that reads the marked record afterwards
  const retry = await preparePluginUpdate({ ...args, policy });
  assert.ok(!("partition" in retry));

  // act
  const retryOutcome = await swapPluginUpdate(args, retry, policy);

  // assert
  assert.strictEqual(retryOutcome.partition, "updated");
  const record = (await loadState(args.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.deepStrictEqual(record?.compatibility, {
    installable: true,
    notes: [],
    supported: ["skills"],
    unsupported: [],
  });
});

test("GLK-06: a swap prepared in the millisecond of another swap's intent mark fails concurrently updated", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-01T00:00:00.000Z") });
  const args = await seedSameRevisionUpdate(t, "update-swap-same-ms-", "2026-01-01T00:00:00.000Z");
  const first = await preparePluginUpdate({ ...args, policy: SAME_REVISION_POLICY });
  const second = await preparePluginUpdate({ ...args, policy: SAME_REVISION_POLICY });
  assert.ok(!("partition" in first));
  assert.ok(!("partition" in second));
  const firstOutcome = await swapPluginUpdate(
    { ...args, stateTransaction: { saveState: refuseFinalizeSave() } },
    first,
    SAME_REVISION_POLICY,
  );
  assert.strictEqual(firstOutcome.partition, "failed");
  const markedState = await readFile(args.locations.stateJsonPath, "utf8");
  const marked = (await loadState(args.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(marked?.updatedAt, "2026-01-01T00:00:00.001Z");

  // act & assert
  await assert.rejects(swapPluginUpdate(args, second, SAME_REVISION_POLICY), (error: unknown) => {
    assert.ok(error instanceof PluginUpdateConcurrencyError);
    assert.deepStrictEqual(
      {
        kind: error.kind,
        plugin: error.plugin,
        marketplace: error.marketplace,
        lifecycle: error.lifecycle,
      },
      { kind: "plugin-updated", plugin: "hello", marketplace: "mp", lifecycle: "intent" },
    );
    return true;
  });
  assert.strictEqual(await readFile(args.locations.stateJsonPath, "utf8"), markedState);
});

test("GLK-06: an intent mark replaces an unparseable updatedAt with the current time", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-03T00:00:00.000Z") });
  const args = await seedSameRevisionUpdate(t, "update-swap-bad-stamp-", "not a date");
  const preflight = await preparePluginUpdate({ ...args, policy: SAME_REVISION_POLICY });
  assert.ok(!("partition" in preflight));

  // act
  const outcome = await swapPluginUpdate(
    { ...args, stateTransaction: { saveState: refuseFinalizeSave() } },
    preflight,
    SAME_REVISION_POLICY,
  );

  // assert
  assert.strictEqual(outcome.partition, "failed");
  const marked = (await loadState(args.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(marked?.updatedAt, "2026-01-03T00:00:00.000Z");
});

test("GLK-06: a finalize stamps the record one millisecond after the intent mark of the same instant", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const args = await seedSameRevisionUpdate(
    t,
    "update-swap-finalize-stamp-",
    "2026-01-01T00:00:00.000Z",
  );
  const preflight = await preparePluginUpdate({ ...args, policy: SAME_REVISION_POLICY });
  assert.ok(!("partition" in preflight));

  // act
  const outcome = await swapPluginUpdate(args, preflight, SAME_REVISION_POLICY);

  // assert
  assert.strictEqual(outcome.partition, "updated");
  const record = (await loadState(args.locations.extensionRoot)).marketplaces.mp?.plugins.hello;
  assert.strictEqual(record?.updatedAt, "2026-01-02T00:00:00.001Z");
});

/**
 * Seeds `hello` 2.0.0 shipping agent `bot`, and an install of 1.0.0 whose own
 * agent file at the same target a user edited (an AG-5 preserved row).
 */
async function seedUserEditedAgentUpdate(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
  const { cwd } = await createHermeticEnvironment(t, "update-swap-overwrite-");
  const marketplaceRoot = path.join(cwd, "mp-src");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "2.0.0", hasSkill: false, hasAgent: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const args = cascadeSwapArgs(cwd);
  const { locations } = args;
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  const target = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
  const editedBytes = "---\nname: bot\n---\nEdited by hand.\n";
  await mkdir(locations.agentsDir, { recursive: true });
  await writeFile(target, editedBytes);
  const indexBytes = JSON.stringify({
    schemaVersion: 1,
    agents: [
      {
        plugin: "hello",
        marketplace: "mp",
        sourceAgent: "bot",
        generatedName: "pi-claude-marketplace-hello-bot",
        sourcePath: path.join(pluginRoot, "agents", "bot.md"),
        targetPath: target,
        sourceHash: "a".repeat(64),
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  });
  await writeFile(locations.agentsIndexPath, indexBytes);
  const state = await loadState(locations.extensionRoot);
  const oldRecord = state.marketplaces.mp?.plugins.hello;
  assert.ok(oldRecord !== undefined);
  oldRecord.resources = {
    skills: [],
    prompts: [],
    agents: ["pi-claude-marketplace-hello-bot"],
    mcpServers: [],
    hooks: [],
    workflows: [],
  };
  await saveState(locations.extensionRoot, state);
  const preflight = await preparePluginUpdate({ ...args, policy: UPDATE_POLICY });
  assert.ok(!("partition" in preflight));
  return { args, preflight, pluginRoot, target, editedBytes, indexBytes, oldRecord };
}

test("D-18-15: an overwrite policy commits over a previous agent file a user edited", async (t) => {
  // arrange
  const { args, preflight, pluginRoot, target, oldRecord } = await seedUserEditedAgentUpdate(t);
  const sourcePath = path.join(pluginRoot, "agents", "bot.md");

  // act
  const outcome = await swapPluginUpdate(args, preflight, {
    refreshSource: false,
    skipSameRevision: false,
    overwrite: true,
    searchReleaseTags: true,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "updated",
    name: "hello",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    notes: ["[bot] source description was missing or empty -- using fallback"],
    stagedAgentNames: ["pi-claude-marketplace-hello-bot"],
    stagedMcpServerNames: [],
    declaresAgents: true,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  });
  assert.strictEqual(
    await readFile(target, "utf8"),
    `---\nname: hello:bot\ndescription: Imported Claude Code plugin agent bot from plugin hello.\naliases: pi-claude-marketplace-hello-bot\ntools: read,grep\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: bot\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings:\n    - source description was missing or empty -- using fallback\n---\n\nBody.\n`,
  );
  assert.deepStrictEqual(JSON.parse(await readFile(args.locations.agentsIndexPath, "utf8")), {
    schemaVersion: 1,
    agents: [
      {
        plugin: "hello",
        marketplace: "mp",
        sourceAgent: "bot",
        generatedName: "pi-claude-marketplace-hello-bot",
        sourcePath,
        targetPath: target,
        sourceHash: createHash("sha256")
          .update("---\nname: bot\ntools: Read,Grep\n---\n\nBody.\n")
          .digest("hex"),
        droppedFields: [],
        droppedTools: [],
        warnings: ["source description was missing or empty -- using fallback"],
      },
    ],
  });
  const state = await loadState(args.locations.extensionRoot);
  assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello, {
    ...oldRecord,
    version: "2.0.0",
    resolvedSource: pluginRoot,
    compatibility: { installable: true, notes: [], supported: ["agents"], unsupported: [] },
    updatedAt: "2026-01-02T00:00:00.001Z",
  });
});

test("D-18-15 / NFR-3: without an overwrite policy a user-edited previous agent file refuses the swap before it changes anything", async (t) => {
  // arrange
  const { args, preflight, target, editedBytes, indexBytes } = await seedUserEditedAgentUpdate(t);
  const stateBefore = await readFile(args.locations.stateJsonPath, "utf8");

  // act & assert
  await assert.rejects(swapPluginUpdate(args, preflight, UPDATE_POLICY), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      {
        name: "Error",
        message: `Cannot replace agent target with non-previous content at ${target}`,
        cause: undefined,
      },
    );
    return true;
  });
  assert.strictEqual(await readFile(target, "utf8"), editedBytes);
  assert.strictEqual(await readFile(args.locations.agentsIndexPath, "utf8"), indexBytes);
  assert.strictEqual(await readFile(args.locations.stateJsonPath, "utf8"), stateBefore);
});

test("exposes the atomic plugin update swap owner", () => {
  // act & assert
  assert.strictEqual(typeof swapPluginUpdate, "function");
});

test("atomically replaces staged resources and finalizes the update ledger", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-success-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert
      assert.strictEqual(outcome.partition, "updated");
      assert.strictEqual(outcome.fromVersion, "1.0.0");
      assert.strictEqual(outcome.toVersion, "2.0.0");
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "2.0.0");
      assert.strictEqual(record?.compatibility.installable, true);
      assert.deepStrictEqual(record?.resources.skills, ["hello-tool"]);
      assert.match(
        await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
        /Body for hello 2\.0\.0\./,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-17a: the updated outcome forwards the preflight's own constraint, key always present", async () => {
  await withHermeticHome(async () => {
    // arrange -- a constrained update (no pin, in-range) so the preflight's
    // `constraint` slot carries a real disclosure.
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-constraint-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
        constraintGate: () =>
          Promise.resolve({
            kind: "admits",
            range: "<=2.0.0",
            holders: [{ key: "alpha@mp", range: "<=2.0.0", disabled: false }],
            fellBackToCurrentCopy: false,
            disclosure: "already the highest version the combined range admits",
          }),
      });
      assert.ok(!("partition" in preflight));
      assert.ok(preflight.constraint !== undefined);

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert -- the SAME value the preflight computed.
      assert.ok(outcome.partition === "updated");
      assert.strictEqual(Object.hasOwn(outcome, "constraint"), true);
      assert.deepStrictEqual(outcome.constraint, preflight.constraint);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-10-17a: an unconstrained update forwards constraint: undefined, key still present", async () => {
  await withHermeticHome(async () => {
    // arrange -- no `constraintGate` injected: the real gate walks a state
    // that declares no dependent for "hello", so the verdict is
    // unconstrained and `preflight.constraint` is `undefined`.
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-unconstrained-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));
      assert.strictEqual(preflight.constraint, undefined);

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert -- the key is present (a plain assignment, not a conditional
      // spread) even though its value is `undefined`.
      assert.ok(outcome.partition === "updated");
      assert.strictEqual(Object.hasOwn(outcome, "constraint"), true);
      assert.strictEqual(outcome.constraint, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-01: a successful path-source swap drops a stale resolvedSha the fresh resolve did not reproduce", async () => {
  await withHermeticHome(async () => {
    // arrange: a STALE `resolvedSha` on the record, as a `path`-source record
    // could carry from a prior tag-pinned install/update. This plugin's
    // marketplace entry is a plain path source with no tag constraint, so its
    // fresh resolve produces no sha at all -- the old one must not survive.
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-stale-sha-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      record.resolvedSha = "stale-sha-from-a-prior-tag-pin";
      await saveState(locations.extensionRoot, state);
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));
      let cleanupCalls = 0;

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => {
            cleanupCalls += 1;
            return Promise.resolve();
          },
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert
      assert.strictEqual(outcome.partition, "updated");
      // UPR-02: the record side had a sha and the candidate none, so only the
      // record's commit is stamped.
      assert.strictEqual(outcome.fromCommit, "stale-sha-from-a-prior-tag-pin");
      assert.strictEqual(Object.hasOwn(outcome, "toCommit"), false);
      const after = await loadState(locations.extensionRoot);
      const afterRecord = after.marketplaces.mp?.plugins.hello;
      assert.ok(afterRecord !== undefined);
      assert.strictEqual(afterRecord.resolvedSha, undefined);
      assert.strictEqual(Object.hasOwn(afterRecord, "resolvedSha"), false);
      // WR-05: the sha moved TO nothing from a prior clone-pinning value, so
      // the old clone is now orphaned -- the post-swap sweep must not skip
      // this case the way "resolvedSha !== undefined" alone would have.
      assert.strictEqual(cleanupCalls, 1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("UPR-02: the updated outcome stamps the record's and the candidate's commits", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-commits-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const fromCommit = "a".repeat(40);
      const toCommit = "b".repeat(40);
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      record.resolvedSha = fromCommit;
      await saveState(locations.extensionRoot, state);
      const prepared = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in prepared));
      // The candidate's sha, as a git source's clone would report it.
      const preflight = { ...prepared, resolvedSha: toCommit };

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert
      assert.ok(outcome.partition === "updated");
      assert.deepStrictEqual(
        { fromCommit: outcome.fromCommit, toCommit: outcome.toCommit },
        { fromCommit, toCommit },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("finalizes the update ledger even when the post-finalize hooks-cache refresh fails", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-hooks-cache-fault-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      t.mock.method(hooksRouting, "rebuildRoutingTables", () => {
        throw new Error("routing rebuild denied");
      });

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting,
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert
      assert.strictEqual(outcome.partition, "updated");
      assert.strictEqual(outcome.fromVersion, "1.0.0");
      assert.strictEqual(outcome.toVersion, "2.0.0");
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "2.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("retains the intent ledger and old resource tree after a replacement failure", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-failure-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });
      const locations = locationsFor("project", cwd);
      await mkdir(locations.skillsTargetDir, { recursive: true });
      const skillObstacle = path.join(locations.skillsTargetDir, "hello-tool");
      await writeFile(skillObstacle, "old-resource-tree");
      const preflight = await preparePluginUpdate({
        policy: UPDATE_POLICY,
        plugin: "hello",
        marketplace: "mp",
        scope: "project",
        locations,
        cleanupClones: () => Promise.resolve(),
      });
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(
        {
          plugin: "hello",
          marketplace: "mp",
          scope: "project",
          cwd,
          locations,
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
          env: {},
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
        UPDATE_POLICY,
      );

      // assert
      assert.strictEqual(outcome.partition, "failed");
      assert.ok("phaseFailures" in outcome);
      assert.deepStrictEqual(
        outcome.phaseFailures.map((failure) => failure.phase),
        ["skills"],
      );
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "1.0.0");
      assert.strictEqual(record?.compatibility.installable, false);
      assert.deepStrictEqual(record?.compatibility.notes, ["update-in-progress"]);
      assert.deepStrictEqual(record?.resources.skills, ["seeded-skill"]);
      assert.strictEqual(await readFile(skillObstacle, "utf8"), "old-resource-tree");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** AFILE-04: seed `hello` 1.0.0 -> 2.0.0 with one MCP server over the given adapter file. */
async function prepareMcpUpdate(cwd: string, adapterText: string) {
  const marketplaceRoot = path.join(cwd, "mp-src");
  await seedPathMarketplace({
    cwd,
    marketplaceRoot,
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "2.0.0", hasMcp: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const locations = locationsFor("project", cwd);
  await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
  await writeFile(locations.mcpAdapterJsonPath, adapterText);
  const args = {
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    cwd,
    locations,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    env: {},
    cascade: true,
    cleanupClones: () => Promise.resolve(),
  } as const;
  return { locations, pluginRoot: path.join(marketplaceRoot, "plugins", "hello"), args };
}

async function preflightOf(
  args: Pick<
    ThreePhaseArgsBase,
    "plugin" | "marketplace" | "scope" | "locations" | "cleanupClones"
  >,
) {
  const preflight = await preparePluginUpdate({
    policy: UPDATE_POLICY,
    plugin: args.plugin,
    marketplace: args.marketplace,
    scope: args.scope,
    locations: args.locations,
    cleanupClones: args.cleanupClones,
  });
  assert.ok(!("partition" in preflight));
  return preflight;
}

const COMMENTED_ADAPTER_TEXT =
  '{\n  // mine\n  "mcpServers": { "mine": { "command": "my-server" } }\n}\n';

const PROJECT_COMMENTS_DROPPED = {
  kind: "comments-dropped",
  scope: "project",
  file: "mcp-adapter.json",
} as const;

test("AFILE-04: a swap over a commented mcp-adapter.json carries the comments-removed notice", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-afile04-"));
    try {
      const { args } = await prepareMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: ["server1"],
        declaresAgents: false,
        declaresMcp: true,
        constraint: undefined,
        declaresWorkflows: false,
        mcpConfigNotices: [PROJECT_COMMENTS_DROPPED],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: a swap over a comment-free mcp-adapter.json carries no notice", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-afile04-clean-"));
    try {
      const { args } = await prepareMcpUpdate(
        cwd,
        '{ "mcpServers": { "mine": { "command": "my-server" } } }\n',
      );
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: ["server1"],
        declaresAgents: false,
        declaresMcp: true,
        constraint: undefined,
        declaresWorkflows: false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Gives `hello` a workflow whose saved target holds foreign content, so the
 * swap's workflows commit refuses it after the MCP commit. Returns that path.
 */
async function seedRefusedWorkflowTarget(
  locations: ReturnType<typeof locationsFor>,
  pluginRoot: string,
): Promise<string> {
  await mkdir(path.join(pluginRoot, "workflows"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "workflows", "greet.js"),
    'export const meta = { name: "greet", description: "does greet" };\n',
  );
  const foreignPath = path.join(locations.workflowsSavedDir, "hello:greet.json");
  await mkdir(locations.workflowsSavedDir, { recursive: true });
  await writeFile(foreignPath, "{}");
  return foreignPath;
}

test("UPR-03: a phase-3 failure outcome carries the commits of the move it attempted", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-phase3-commits-"));
    try {
      const { locations, pluginRoot, args } = await prepareMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      await seedRefusedWorkflowTarget(locations, pluginRoot);
      const fromCommit = "a".repeat(40);
      const toCommit = "b".repeat(40);
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      record.resolvedSha = fromCommit;
      await saveState(locations.extensionRoot, state);
      const preflight = { ...(await preflightOf(args)), resolvedSha: toCommit };

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.ok(outcome.partition === "failed");
      assert.deepStrictEqual(
        {
          fromVersion: outcome.fromVersion,
          toVersion: outcome.toVersion,
          fromCommit: outcome.fromCommit,
          toCommit: outcome.toCommit,
          reasons: outcome.reasons,
        },
        {
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          fromCommit,
          toCommit,
          reasons: ["rollback partial"],
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: a swap whose workflows commit fails after the MCP commit carries the notice", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-afile04-failed-"));
    try {
      const { locations, pluginRoot, args } = await prepareMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      const foreignPath = await seedRefusedWorkflowTarget(locations, pluginRoot);
      const preflight = await preflightOf(args);
      const refusal = `Cannot replace workflow target with non-previous content at ${foreignPath}`;

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        notes: [
          'Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it.',
          `workflows: ${refusal}`,
        ],
        reasons: ["rollback partial"],
        phaseFailures: [{ phase: "workflows", msg: refusal }],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        mcpConfigNotices: [PROJECT_COMMENTS_DROPPED],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const LEGACY_MCP_JSON_TEXT = `{
  // released build
  "mcpServers": {
    "server1": {
      "command": "old",
      "_piClaudeMarketplace": { "plugin": "hello", "marketplace": "mp" }
    },
    "other": { "command": "y" }
  }
}
`;

test("AMIG-02: a swap removes the plugin's marked mcp.json entries after the MCP commit and reports them after the stage notices", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-amig02-"));
    try {
      const { locations, args } = await prepareMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      await writeFile(locations.mcpJsonPath, LEGACY_MCP_JSON_TEXT);
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "updated",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: ["server1"],
        declaresAgents: false,
        declaresMcp: true,
        constraint: undefined,
        declaresWorkflows: false,
        mcpConfigNotices: [
          PROJECT_COMMENTS_DROPPED,
          { kind: "comments-dropped", scope: "project", file: "mcp.json" },
        ],
      });
      assert.strictEqual(
        await readFile(locations.mcpJsonPath, "utf8"),
        '{\n  "mcpServers": {\n    "other": {\n      "command": "y"\n    }\n  }\n}\n',
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AMIG-02: a legacy removal that fails records an mcp phase failure and keeps both entries", async (t) => {
  // A 0o555 directory stays writable for uid 0, so the removal would succeed.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("this case cannot deny root; run this suite as a non-root user");
  }

  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-amig02-failed-"));
    try {
      const { locations, pluginRoot, args } = await prepareMcpUpdate(cwd, COMMENTED_ADAPTER_TEXT);
      const lockedDirectory = path.join(cwd, "locked");
      await mkdir(lockedDirectory);
      await writeFile(path.join(lockedDirectory, "mcp.json"), LEGACY_MCP_JSON_TEXT);
      await symlink(path.join(lockedDirectory, "mcp.json"), locations.mcpJsonPath);
      t.after(async () => {
        await chmod(lockedDirectory, 0o700).catch(() => undefined);
      });
      await chmod(lockedDirectory, 0o555);
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);
      await chmod(lockedDirectory, 0o700);

      // assert
      assert.ok(outcome.partition === "failed");
      const failureMsg = outcome.phaseFailures?.[0]?.msg ?? "";
      assert.match(failureMsg, /^EACCES: permission denied, open '.*\/locked\/mcp\.json\.\d+'$/);
      assert.deepStrictEqual(outcome, {
        partition: "failed",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        notes: [
          'Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it.',
          `mcp: ${failureMsg}`,
        ],
        reasons: ["rollback partial"],
        phaseFailures: [{ phase: "mcp", msg: failureMsg }],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        mcpConfigNotices: [PROJECT_COMMENTS_DROPPED],
      });
      assert.strictEqual(await readFile(locations.mcpJsonPath, "utf8"), LEGACY_MCP_JSON_TEXT);
      assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")), {
        mcpServers: {
          mine: { command: "my-server" },
          plugin_hello_server1_: {
            command: "node",
            args: ["s.js"],
            env: {
              CLAUDE_PLUGIN_ROOT: pluginRoot,
              CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            },
            directTools: "search",
            toolPrefix: "mcp",
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Seed `hello` 1.0.0 with 2.0.0 offered and build the direct swap arguments,
 * whose context records every message the swap emits.
 */
async function prepareDirectUpdate(cwd: string) {
  await seedPathMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    marketplaceName: "mp",
    manifestPlugins: { hello: { version: "2.0.0", hasSkill: true } },
    installedVersions: { hello: "1.0.0" },
  });
  const locations = locationsFor("project", cwd);
  const messages: string[] = [];
  const args = {
    plugin: "hello",
    marketplace: "mp",
    scope: "project",
    cwd,
    locations,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
    env: {},
    cascade: false,
    ctx: {
      mode: "tui",
      ui: {
        notify: (message: string): void => {
          messages.push(message);
        },
      },
    },
    run: runWithNothingLoaded(),
    cardinality: "single",
    notifyPhaseFailure: (error: Error): void => {
      messages.push(error.message);
    },
    cleanupClones: () => Promise.resolve(),
  } satisfies DirectThreePhaseArgs;
  return { locations, args, messages };
}

const DIRECT_UPDATED_OUTCOME = {
  partition: "updated",
  name: "hello",
  fromVersion: "1.0.0",
  toVersion: "2.0.0",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  declaresAgents: false,
  declaresMcp: false,
  constraint: undefined,
  declaresWorkflows: false,
} as const;

test("LAYER-04: a direct swap writes no layer config", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-no-layer-"));
    try {
      const { locations, args, messages } = await prepareDirectUpdate(cwd);
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, DIRECT_UPDATED_OUTCOME);
      assert.deepStrictEqual(messages, []);
      await assert.rejects(readFile(locations.baseConfigJsonPath), { code: "ENOENT" });
      await assert.rejects(readFile(locations.localConfigJsonPath), { code: "ENOENT" });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: a direct swap with an unreadable local layer updates, renders nothing, and leaves the layer unchanged", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "update-swap-invalid-layer-"));
    try {
      const { locations, args, messages } = await prepareDirectUpdate(cwd);
      await writeFile(locations.localConfigJsonPath, "{ not json");
      const mtimeBefore = (await stat(locations.localConfigJsonPath)).mtimeMs;
      const preflight = await preflightOf(args);

      // act
      const outcome = await swapPluginUpdate(args, preflight, UPDATE_POLICY);

      // assert
      assert.deepStrictEqual(outcome, DIRECT_UPDATED_OUTCOME);
      assert.deepStrictEqual(messages, []);
      assert.strictEqual(await readFile(locations.localConfigJsonPath, "utf8"), "{ not json");
      assert.strictEqual((await stat(locations.localConfigJsonPath)).mtimeMs, mtimeBefore);
      await assert.rejects(readFile(locations.baseConfigJsonPath), { code: "ENOENT" });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
