import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

// The flow suite supplies the real bridge, filesystem, rollback, and
// state-ledger fixtures while this mirrored owner pair proves they execute
// through the extracted swap module.
import { seedPathMarketplace, withHermeticHome } from "./update-flow.test.ts";

import type { TestContext } from "node:test";

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
      `---\nname: ${agent.generatedName}\ndescription: ${agent.description}\ntools: read,grep\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: ${agent.sourceName}\n  sourcePath: ${agentSourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\n${agent.body}`,
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
    resources: { skills: [], prompts: [], agents: expectedNames, mcpServers: [], hooks: [] },
    updatedAt: "2026-01-02T00:00:00.000Z",
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
      const preflight = await preparePluginUpdate(fixture.options);
      assert.ok(!("partition" in preflight));

      // act
      const outcome = await swapPluginUpdate(fixture.options, preflight);

      // assert
      await assertAgentsMigrated({ outcome, coexist, fixture });
    });
  });
}

test("AGENT-01: update retries agent migration once the occupying target is freed", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const fixture = await seedLegacyAgentUpdate(t, false);
    const { locations, newTarget, oldTarget, oldBytes, oldIndexBytes, oldRecord, options } =
      fixture;
    const preflight = await preparePluginUpdate(options);
    assert.ok(!("partition" in preflight));
    await writeFile(newTarget, "Foreign new target.\n");

    // act
    const failure = await swapPluginUpdate(options, preflight);

    // assert
    const message = `Cannot replace agent target with non-previous content at ${newTarget}`;
    assert.deepStrictEqual(failure, {
      partition: "failed",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      notes: [
        'Plugin "hello" update failed during physical replace. plugin-uninstall + plugin-install for "hello".',
        `agents: ${message}`,
      ],
      reasons: ["rollback partial"],
      phaseFailures: [{ phase: "agents", msg: message }],
      declaresAgents: false,
      declaresMcp: false,
    });
    assert.strictEqual(await readFile(oldTarget, "utf8"), oldBytes);
    assert.strictEqual(await readFile(newTarget, "utf8"), "Foreign new target.\n");
    assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), oldIndexBytes);
    const failedState = await loadState(locations.extensionRoot);
    assert.deepStrictEqual(failedState.marketplaces.mp?.plugins.hello, {
      ...oldRecord,
      compatibility: {
        ...oldRecord.compatibility,
        installable: false,
        notes: ["update-in-progress"],
      },
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    // arrange: the occupying file is gone, so the retry can replace it
    await rm(newTarget);
    const retryPreflight = await preparePluginUpdate(options);
    assert.ok(!("partition" in retryPreflight));

    // act
    const outcome = await swapPluginUpdate(options, retryPreflight);

    // assert
    await assertAgentsMigrated({ outcome, coexist: false, fixture });
  });
});

test("exposes the atomic plugin update swap owner", () => {
  // act and assert
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
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
      );

      // assert
      assert.strictEqual(outcome.partition, "updated");
      assert.strictEqual(outcome.fromVersion, "1.0.0");
      assert.strictEqual(outcome.toVersion, "2.0.0");
      const state = await loadState(locations.extensionRoot);
      const record = state.marketplaces.mp?.plugins.hello;
      assert.strictEqual(record?.version, "2.0.0");
      assert.strictEqual(record?.compatibility.installable, true);
      assert.deepStrictEqual(record?.resources.skills, ["hello:tool"]);
      assert.match(
        await readFile(path.join(locations.skillsTargetDir, "hello:tool", "SKILL.md"), "utf8"),
        /Body for hello 2\.0\.0\./,
      );
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
      const skillObstacle = path.join(locations.skillsTargetDir, "hello:tool");
      await writeFile(skillObstacle, "old-resource-tree");
      const preflight = await preparePluginUpdate({
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
          cascade: true,
          cleanupClones: () => Promise.resolve(),
        },
        preflight,
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
