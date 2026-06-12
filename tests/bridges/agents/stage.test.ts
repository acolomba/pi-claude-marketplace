import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  abortPreparedAgents,
  commitPreparedAgents,
  finalizeAgentsReplacement,
  prepareStagePluginAgents,
  replacePreparedAgents,
  rollbackAgentsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/stage.ts";
import { loadAgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { atomicWriteJson } from "../../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
import { AgentOwnershipConflictError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import {
  cleanupStaging,
  pathExists,
} from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

// AG-1 / AG-2 / AG-3 / AG-5 / AG-7 / AG-9 / AS-9: end-to-end prepare +
// commit + abort tests.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "..", "_fixtures");

function makeResolved(name: string, pluginRoot: string): ResolvedPluginInstallable {
  return {
    installable: true,
    name,
    pluginRoot,
    supported: ["agents"],
    unsupported: [],
    notes: [],
    // D-07: componentPaths.agents is `readonly string[]`.
    componentPaths: { skills: [], commands: [], agents: ["agents"] },
    mcpServers: {},
  };
}

async function withTmpScope<T>(
  fn: (ctx: { scopeRoot: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "agents-stage-"));
  const locations = locationsFor("project", tmp);
  try {
    return await fn({ scopeRoot: tmp, locations });
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
}

test("AG-1 commitPreparedAgents lands files at <scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md (happy path)", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const agentsDir = path.join(pluginRoot, "agents");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: agentsDir,
    });

    assert.equal(prepared.kind, "staged");
    assert.deepEqual([...prepared.result.stagedNames].sort(), [
      "pi-claude-marketplace-acme-bot",
      "pi-claude-marketplace-acme-helper",
    ]);
    // recorded[] populated for state.json.installs.
    assert.equal(prepared.result.recorded.length, 2);

    await commitPreparedAgents(prepared);

    const botStat = await stat(path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md"));
    assert.ok(botStat.isFile());
    const helperStat = await stat(
      path.join(locations.agentsDir, "pi-claude-marketplace-acme-helper.md"),
    );
    assert.ok(helperStat.isFile());
  });
});

test("AG-2 saveAgentsIndex called with schemaVersion:1 and 2 rows (happy path)", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    const loaded = await loadAgentsIndex(locations);
    assert.equal(loaded.schemaVersion, 1);
    assert.equal(loaded.agents.length, 2);
    const names = loaded.agents.map((a) => a.generatedName).sort();
    assert.deepEqual(names, [
      "pi-claude-marketplace-acme-bot",
      "pi-claude-marketplace-acme-helper",
    ]);
  });
});

test("AG-3 re-staging plugin X in mp1 leaves plugin X in mp2 rows untouched", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Pre-seed the index with a row for mp2/acme. The targetPath uses a
    // generatedName that does NOT collide with mp1's set so AG-9 doesn't
    // fire. We use "pi-claude-marketplace-acme-mp2only" -- a name that mp1's
    // staging will not produce.
    const seedTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-mp2only.md");
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp2",
          sourceAgent: "mp2only",
          generatedName: "pi-claude-marketplace-acme-mp2only",
          sourcePath: "/orig/source.md",
          targetPath: seedTarget,
          sourceHash: "deadbeef",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    const loaded = await loadAgentsIndex(locations);
    // mp2's row preserved + 2 new mp1 rows.
    assert.equal(loaded.agents.length, 3);
    const mp2Row = loaded.agents.find((a) => a.marketplace === "mp2");
    assert.ok(mp2Row);
    assert.equal(mp2Row.generatedName, "pi-claude-marketplace-acme-mp2only");
  });
});

test("AG-5 prepare SURFACES foreign content via result.failed[] when previous targetPath has wrong basename", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Pre-seed: index claims a row whose targetPath has a wrong basename
    // (no pi-claude-marketplace- prefix). The file exists on disk.
    await mkdir(locations.agentsDir, { recursive: true });
    const foreignTarget = path.join(locations.agentsDir, "foreign-thing.md");
    await writeFile(foreignTarget, "---\nname: foreign\n---\nbody\n", "utf8");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "ghost",
          generatedName: "pi-claude-marketplace-acme-ghost",
          sourcePath: "/orig/ghost.md",
          targetPath: foreignTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    assert.equal(prepared.kind, "staged");
    assert.ok(prepared.result.failed.length >= 1);
    const failure = prepared.result.failed.find((f) => f.targetPath === foreignTarget);
    assert.ok(failure);
    assert.match(failure.reason, /does not start with/);
  });
});

test("AG-5 prepare SURFACES foreign content via result.failed[] when previous targetPath body lacks marker", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Pre-seed: the targetPath has the right basename but the body lacks
    // the marker -- foreign file masquerading as ours.
    await mkdir(locations.agentsDir, { recursive: true });
    const fakeMineTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-ghost.md");
    await writeFile(fakeMineTarget, "---\nname: ghost\n---\nbody without marker\n", "utf8");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "ghost",
          generatedName: "pi-claude-marketplace-acme-ghost",
          sourcePath: "/orig/ghost.md",
          targetPath: fakeMineTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    assert.equal(prepared.kind, "staged");
    const failure = prepared.result.failed.find((f) => f.targetPath === fakeMineTarget);
    assert.ok(failure);
    assert.match(failure.reason, /missing the generated marker/);
  });
});

test("AG-5 commit preserves foreign target on disk byte-identical when previous entry was AG-5-foreign", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    await mkdir(locations.agentsDir, { recursive: true });
    const foreignTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-foreign.md");
    const foreignBytes = "---\nname: foreign\n---\nthis is not ours\n";
    await writeFile(foreignTarget, foreignBytes, "utf8");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "foreign",
          generatedName: "pi-claude-marketplace-acme-foreign",
          sourcePath: "/orig/foreign.md",
          targetPath: foreignTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    const after = await readFile(foreignTarget, "utf8");
    assert.equal(after, foreignBytes);
  });
});

test("AG-5 commit preserves foreign-content index row in agents:", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    await mkdir(locations.agentsDir, { recursive: true });
    const foreignTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-foreign.md");
    await writeFile(foreignTarget, "---\nname: foreign\n---\nbody\n", "utf8");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "foreign",
          generatedName: "pi-claude-marketplace-acme-foreign",
          sourcePath: "/orig/foreign.md",
          targetPath: foreignTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    const loaded = await loadAgentsIndex(locations);
    const preserved = loaded.agents.find(
      (a) => a.generatedName === "pi-claude-marketplace-acme-foreign",
    );
    assert.ok(preserved, "expected foreign-content row preserved in index");
    // Plus the 2 new rows.
    assert.equal(loaded.agents.length, 3);
  });
});

test("PRL-10 replacePreparedAgents can rollback files and agents-index", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const oldBytes = "old generated by pi-claude-marketplace bytes";
    await writeFile(targetPath, oldBytes, "utf8");
    const oldIndex = await readFile(locations.agentsIndexPath, "utf8");

    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    const replacement = await replacePreparedAgents(second);
    assert.notEqual(await readFile(targetPath, "utf8"), oldBytes);
    assert.equal((await loadAgentsIndex(locations)).agents.length, 2);

    const leaks = await rollbackAgentsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await readFile(targetPath, "utf8"), oldBytes);
    assert.equal(await readFile(locations.agentsIndexPath, "utf8"), oldIndex);
  });
});

test("PRL-10 replacePreparedAgents blocks foreign previous content by default", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);
    const foreignTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-foreign.md");
    const foreignBytes = "---\nname: foreign\n---\nmanual bytes\n";
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "foreign",
          generatedName: "pi-claude-marketplace-acme-foreign",
          sourcePath: "/orig/foreign.md",
          targetPath: foreignTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(foreignTarget, foreignBytes, "utf8");
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);
    const oldIndex = await readFile(locations.agentsIndexPath, "utf8");

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");
    assert.ok(prepared.result.failed.length > 0);

    await assert.rejects(
      () => replacePreparedAgents(prepared),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /pi-claude-marketplace-acme-foreign/);
        assert.match(err.message, /manual bytes|missing the generated marker/);
        return true;
      },
    );
    assert.equal(await readFile(foreignTarget, "utf8"), foreignBytes);
    assert.equal(await readFile(locations.agentsIndexPath, "utf8"), oldIndex);
  });
});

test("PRL-10 replacePreparedAgents force overwrites foreign previous content and rollback restores it", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);
    const foreignTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-foreign.md");
    const foreignBytes = "---\nname: foreign\n---\nmanual bytes\n";
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "foreign",
          generatedName: "pi-claude-marketplace-acme-foreign",
          sourcePath: "/orig/foreign.md",
          targetPath: foreignTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(foreignTarget, foreignBytes, "utf8");
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);
    const oldIndex = await readFile(locations.agentsIndexPath, "utf8");

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    const replacement = await replacePreparedAgents(prepared, { force: true });
    assert.equal(await pathExists(foreignTarget), false);
    assert.equal((await loadAgentsIndex(locations)).agents.length, 2);

    const leaks = await rollbackAgentsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await readFile(foreignTarget, "utf8"), foreignBytes);
    assert.equal(await readFile(locations.agentsIndexPath, "utf8"), oldIndex);
  });
});

test("PRL-10 noop agent replacements rollback and finalize without leaks", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: "",
    });

    const replacement = await replacePreparedAgents(prepared);
    assert.equal(replacement.kind, "noop");
    assert.deepEqual([...(await rollbackAgentsReplacement(replacement))], []);
    assert.deepEqual([...(await finalizeAgentsReplacement(replacement))], []);
  });
});

test("AG-9/RN-4 prepare throws AgentOwnershipConflictError on cross-(mp,plugin) generated-name collision", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Pre-seed: another (mp2, rival) ALREADY owns "pi-claude-marketplace-acme-bot".
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "rival",
          marketplace: "mp2",
          sourceAgent: "acme-bot",
          generatedName: "pi-claude-marketplace-acme-bot",
          sourcePath: "/orig/rival.md",
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md"),
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    await assert.rejects(
      () =>
        prepareStagePluginAgents({
          locations,
          marketplaceName: "mp1",
          pluginName: "acme",
          pluginRoot,
          pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
          resolved,
          agentsSourceDir: path.join(pluginRoot, "agents"),
        }),
      (err: unknown) => {
        assert.ok(err instanceof AgentOwnershipConflictError);
        assert.equal(err.conflicts.length, 1);
        assert.equal(err.conflicts[0]?.generatedName, "pi-claude-marketplace-acme-bot");
        assert.equal(err.conflicts[0]?.owner.marketplace, "mp2");
        assert.equal(err.conflicts[0]?.owner.plugin, "rival");
        return true;
      },
    );
  });
});

test("AS-9 prepare returns kind:'noop' when agentsSourceDir is '' AND no previous entries", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: "",
    });
    assert.equal(prepared.kind, "noop");
    assert.equal(prepared.result.stagedNames.length, 0);
    assert.equal(prepared.result.recorded.length, 0);
    assert.equal(prepared.result.failed.length, 0);
  });
});

test("AS-9 commit on noop is a no-op (no agents/ dir created, no agents-index.json materialized)", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: "",
    });
    const leak = await commitPreparedAgents(prepared);
    assert.equal(leak, undefined);

    // No agents/ dir.
    assert.equal(await pathExists(locations.agentsDir), false);
    // No agents-index.json.
    assert.equal(await pathExists(locations.agentsIndexPath), false);
  });
});

test("AS-9 prepare with discovered agents but no previous entries returns kind:'staged'", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");
  });
});

test("AG-7 staged file content includes substituted ${CLAUDE_PLUGIN_ROOT}", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    // bot.md has body "Read from ${CLAUDE_PLUGIN_ROOT}/data."
    const botContent = await readFile(
      path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md"),
      "utf8",
    );
    assert.ok(botContent.includes(`${pluginRoot}/data`));
    assert.ok(!botContent.includes("${CLAUDE_PLUGIN_ROOT}"));
  });
});

test("AG-5 staged file basename starts with pi-claude-marketplace-", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    for (const name of prepared.result.stagedNames) {
      assert.ok(name.startsWith("pi-claude-marketplace-"), `name ${name} missing prefix`);
    }
  });
});

test("AG-5 staged file body contains GENERATED_AGENT_MARKER substring", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(prepared);

    for (const name of prepared.result.stagedNames) {
      const content = await readFile(path.join(locations.agentsDir, name + ".md"), "utf8");
      assert.ok(content.includes("generated by pi-claude-marketplace"));
    }
  });
});

test("commit re-stage path: rm previous targets first, then rename staged", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // First install.
    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const firstContent = await readFile(targetPath, "utf8");
    assert.ok(firstContent.includes("generated by pi-claude-marketplace"));

    // Re-install (simulates an update). After commit the file should still
    // exist (rm + rename, not orphaned), and content should still contain
    // marker (idempotent re-stage).
    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(second);

    const secondContent = await readFile(targetPath, "utf8");
    assert.ok(secondContent.includes("generated by pi-claude-marketplace"));
  });
});

test("abort cleans up staging dir without touching target dir", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      throw new Error("prepared.kind must be 'staged' for this test");
    }

    const stagingDir = prepared.stagingDir;
    assert.equal(await pathExists(stagingDir), true);

    await abortPreparedAgents(prepared);

    // Staging dir gone; agents dir never created.
    assert.equal(await pathExists(stagingDir), false);
    assert.equal(await pathExists(locations.agentsDir), false);
  });
});

test("PRL-10 finalizeAgentsReplacement throws on unknown replacement handle (defensive)", async () => {
  const bogus = { kind: "replaced" } as Parameters<typeof finalizeAgentsReplacement>[0];
  await assert.rejects(() => finalizeAgentsReplacement(bogus), /Unknown agents replacement handle/);
});

test("PRL-10 replacePreparedAgents internal rename failure rolls back and propagates with manual-recovery prefix when leaks", async (t) => {
  // POSIX-only: chmod the agents target dir read-only after prepare but
  // before the inner rename of staged files. The first staged rename fails
  // with EACCES, triggering rollbackAgentsReplacementInternal. Because the
  // backup dir is still writable, rollback runs cleanly (no leaks), so the
  // original error rethrows verbatim (no ManualRecoveryError wrap).
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block rename");
    return;
  }

  const { chmod } = await import("node:fs/promises");

  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    // Lock the agents directory so the inner `rename(pair.from, pair.to)`
    // throws EACCES on the first staged file.
    await chmod(locations.agentsDir, 0o500);

    try {
      await assert.rejects(() => replacePreparedAgents(second), /EACCES|permission/i);
    } finally {
      await chmod(locations.agentsDir, 0o755);
    }
  });
});

test("AG-1 prepare/replace skips backup loop entries that vanish between prepare and replace", async (t) => {
  // The replace path's backup loop has a "skip if target doesn't exist"
  // branch. To trigger it: stage agents, then between prepare and replace
  // remove the target file out-of-band. The backup loop should `continue`
  // past the missing entry without throwing.
  if (process.platform === "win32") {
    t.skip("POSIX-only file manipulation");
    return;
  }

  const { rm } = await import("node:fs/promises");

  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    // Remove the recorded previous target between prepare and replace.
    const previousTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    await rm(previousTarget, { force: true });

    // Replace should still succeed: the backup loop skips the missing
    // target, then the staged file is renamed into place.
    const replacement = await replacePreparedAgents(second);
    assert.equal(replacement.kind, "replaced");
    assert.equal(await pathExists(previousTarget), true);
  });
});

test("PRL-10 replacePreparedAgents rollback removes new agents-index when none existed before", async () => {
  // First replace from a clean scope (no prior agents-index). rollback's
  // restoreAgentsIndex hits the `oldIndexText === undefined` branch and
  // rm's the freshly-written index file.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    const replacement = await replacePreparedAgents(prepared);
    assert.equal(await pathExists(locations.agentsIndexPath), true);

    const leaks = await rollbackAgentsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await pathExists(locations.agentsIndexPath), false);
  });
});

test("PRL-10 readOptionalText (non-ENOENT) -> rethrows from inside replacePreparedAgents", async (t) => {
  // POSIX-only: chmod a previous agents-index.json to 0 so the
  // readOptionalText call inside replacePreparedAgents hits the
  // non-ENOENT branch, which rethrows.
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block readFile");
    return;
  }

  const { chmod } = await import("node:fs/promises");

  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    // chmod the existing index file to 0 so readOptionalText throws EACCES.
    await chmod(locations.agentsIndexPath, 0o000);

    try {
      await assert.rejects(() => replacePreparedAgents(second), /EACCES|permission/i);
    } finally {
      await chmod(locations.agentsIndexPath, 0o644);
    }
  });
});

test("formatAgentWarnings emits dropped-fields line when agent has unknown frontmatter fields", async () => {
  // droppedFields non-empty -> out.push(`[...] dropped fields: ...`)
  await withTmpScope(async ({ locations }) => {
    const tmpPluginRoot = await mkdtemp(path.join(os.tmpdir(), "agents-stage-droppedfields-"));
    const agentsDir = path.join(tmpPluginRoot, "agents");
    await mkdir(agentsDir, { recursive: true });
    // Write an agent with an unsupported frontmatter field `priority` so the
    // converter records it in droppedFields.
    await writeFile(
      path.join(agentsDir, "fancy-bot.md"),
      "---\nname: fancy-bot\ndescription: A fancy bot\ntools: Read\npriority: high\n---\n\nBody.\n",
      "utf8",
    );

    const resolved = makeResolved("acme", tmpPluginRoot);
    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot: tmpPluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: agentsDir,
    });

    assert.equal(prepared.kind, "staged");
    assert.ok(
      prepared.result.warnings.some((w) => w.includes("dropped fields:")),
      `expected a 'dropped fields:' warning; got: ${JSON.stringify(prepared.result.warnings)}`,
    );
  });
});

test("formatAgentWarnings emits dropped-tools line when agent has unmapped tool names", async () => {
  // droppedTools non-empty -> out.push(`[...] dropped tools: ...`)
  await withTmpScope(async ({ locations }) => {
    const tmpPluginRoot = await mkdtemp(path.join(os.tmpdir(), "agents-stage-droppedtools-"));
    const agentsDir = path.join(tmpPluginRoot, "agents");
    await mkdir(agentsDir, { recursive: true });
    // Include tools that are NOT in TOOL_MAP (e.g., WebFetch, TodoWrite) so
    // the converter records them in droppedTools.
    await writeFile(
      path.join(agentsDir, "tool-bot.md"),
      "---\nname: tool-bot\ndescription: A tool bot\ntools: Read,WebFetch,TodoWrite\n---\n\nBody.\n",
      "utf8",
    );

    const resolved = makeResolved("acme", tmpPluginRoot);
    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot: tmpPluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: agentsDir,
    });

    assert.equal(prepared.kind, "staged");
    assert.ok(
      prepared.result.warnings.some((w) => w.includes("dropped tools:")),
      `expected a 'dropped tools:' warning; got: ${JSON.stringify(prepared.result.warnings)}`,
    );
  });
});

test("abortPreparedAgents returns undefined immediately for noop prepared result", async () => {
  // kind === 'noop' -> return undefined
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Empty agentsSourceDir and no prior index entries -> noop.
    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: "",
    });
    assert.equal(prepared.kind, "noop");

    const result = await abortPreparedAgents(prepared);
    assert.equal(result, undefined);
  });
});

test("replacePreparedAgents throws when staged target path already exists with non-previous content", async () => {
  // pathExists(pair.to) true -> throws 'Cannot replace agent target...'
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");

    // Place a file at a staged target path that was NOT part of the previous
    // index -- the backup loop won't have renamed it away, so pathExists on
    // pair.to will be true and replacePreparedAgents must throw.
    await mkdir(locations.agentsDir, { recursive: true });
    const intruder = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    await writeFile(intruder, "---\nname: intruder\n---\nnot ours\n", "utf8");

    await assert.rejects(
      () => replacePreparedAgents(prepared),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Cannot replace agent target/);
        assert.match(err.message, /pi-claude-marketplace-acme-bot/);
        return true;
      },
    );
  });
});

test("PRL-10 rollbackAgentsReplacement records leak when restoreAgentsIndex fails", async (t) => {
  // POSIX-only: after replace, chmod the extension root read-only so the
  // rollback's `writeFile` to the agents-index path fails. The catch block
  // in restoreAgentsIndex records a leak.
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block writeFile");
    return;
  }

  const { chmod, rm } = await import("node:fs/promises");

  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    const replacement = await replacePreparedAgents(second);
    // Remove the freshly-written index file, then lock the parent dir so
    // restoreAgentsIndex's writeFile-of-previous fails with EACCES.
    await rm(locations.agentsIndexPath, { force: true });
    await chmod(path.dirname(locations.agentsIndexPath), 0o500);

    try {
      const leaks = await rollbackAgentsReplacement(replacement);
      assert.ok(leaks.length >= 1, "expected restoreAgentsIndex leak");
      assert.ok(
        leaks.some((l) => l.includes("failed to restore agents index")),
        `expected agents-index restore leak in: ${JSON.stringify(leaks)}`,
      );
    } finally {
      await chmod(path.dirname(locations.agentsIndexPath), 0o755);
    }
  });
});

// TR-01 sequential commit rollback (agents) ------------------------------

test("TR-01 commitPreparedAgents sequential commit rolls back completed renames on throw", async () => {
  // 2 staged agents (acme-helper sorts before bot). Pre-seed pair #2's
  // target (`pi-claude-marketplace-acme-bot.md`) as a non-empty directory
  // so the second forward rename fails with ENOTEMPTY/EISDIR. The first
  // rename should succeed; the catch reverse-walks completedRenames and
  // restores the helper file to staging.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      throw new Error("prepared.kind must be 'staged' for this test");
    }

    // Pre-seed the agentsDir + obstacle directory for pair #2 (bot.md).
    await mkdir(locations.agentsDir, { recursive: true });
    const obstacleDir = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    await mkdir(obstacleDir, { recursive: true });
    await writeFile(path.join(obstacleDir, "blocker.txt"), "non-empty");

    // Sanity: 2 staged files; the helper sorts before the bot.
    assert.equal(prepared._stagedFilePaths.length, 2);
    const helperPair = prepared._stagedFilePaths.find((p) =>
      p.to.endsWith("pi-claude-marketplace-acme-helper.md"),
    );
    assert.ok(helperPair, "expected an acme-helper staged pair");

    await assert.rejects(
      () => commitPreparedAgents(prepared),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        // Original error surfaces (ENOTEMPTY/EISDIR/etc). The exact errno
        // text varies by platform; just confirm we got SOME error.
        return true;
      },
    );

    // Key observable: after rollback + cleanup, the agentsDir contains
    // ONLY the pre-seeded obstacle directory -- no acme-helper.md file
    // landed (rolled back) and no bot.md file landed (forward #2 never
    // succeeded). Without TR-01 rollback, the helper file would have been
    // left at the target as a partial-commit orphan.
    const helperAtTargetStat = await stat(
      path.join(locations.agentsDir, "pi-claude-marketplace-acme-helper.md"),
    ).catch(() => null);
    assert.equal(
      helperAtTargetStat,
      null,
      "rollback must have removed the helper file from the target",
    );

    // The pre-seeded obstacle dir is still in place (untouched by rollback).
    const obstacleStat = await stat(obstacleDir);
    assert.ok(obstacleStat.isDirectory(), "pre-seeded obstacle dir survives");

    // Staging dir is cleaned up by the catch's final cleanupStaging.
    assert.equal(
      await pathExists(prepared.stagingDir),
      false,
      "staging dir must be cleaned up after the failed commit",
    );

    // Silence unused-variable lint for helperPair (only used as a sanity
    // check that the sort order matches our pre-seed key).
    void helperPair;
  });
});

test("TR-01 commitPreparedAgents rollback rename failure surfaces via appendLeaks", async () => {
  // Same shape as the previous test (pair #2 target pre-seeded as non-empty
  // dir to force ENOTEMPTY on forward rename #2). Additionally, mutate
  // pair #1's `from` getter so the second access (rollback's
  // `rename(pair.to, pair.from)`) reads a path that is itself a non-empty
  // directory -- forcing the rollback rename to fail with ENOTEMPTY too.
  // The bridge catches the rollback failure into rollbackLeaks[] and
  // surfaces it via appendLeaks, NOT ManualRecoveryError.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    const prepared = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      throw new Error("prepared.kind must be 'staged' for this test");
    }

    // Force rename #2 to throw ENOTEMPTY by pre-seeding its target as a
    // non-empty directory.
    await mkdir(locations.agentsDir, { recursive: true });
    const obstacleDir = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    await mkdir(obstacleDir, { recursive: true });
    await writeFile(path.join(obstacleDir, "blocker.txt"), "non-empty");

    // Pre-create a non-empty directory at a fresh path that will be used as
    // the rollback destination for pair #1.
    const rollbackBlocker = path.join(prepared.stagingDir, "rollback-blocker.md");
    await mkdir(rollbackBlocker, { recursive: true });
    await writeFile(path.join(rollbackBlocker, "child.txt"), "non-empty");

    // Mutate pair #1 (helper) so `pair.from` returns the real staging path
    // on the first access (forward rename) and the non-empty blocker dir
    // path on the second access (rollback rename). This forces rollback
    // rename to fail with ENOTEMPTY/EISDIR, exercising the rollbackLeaks[]
    // accumulation + appendLeaks chain in the catch block.
    const helperPair = prepared._stagedFilePaths.find((p) =>
      p.to.endsWith("pi-claude-marketplace-acme-helper.md"),
    ) as { from: string; to: string } | undefined;
    assert.ok(helperPair, "expected an acme-helper staged pair");

    const realFrom = helperPair.from;
    let fromAccessCount = 0;
    // Inner object isn't frozen (only the outer array is); we can redefine
    // `from` as a getter. The narrowed type is already mutable -- delete
    // via Partial<> cast so strict-mode delete-of-required is permitted.
    const mutablePair = helperPair;
    delete (mutablePair as Partial<typeof mutablePair>).from;
    Object.defineProperty(mutablePair, "from", {
      get() {
        fromAccessCount += 1;
        // Access #1: forward rename source. Access #2: rollback rename dest.
        return fromAccessCount === 1 ? realFrom : rollbackBlocker;
      },
      configurable: true,
      enumerable: true,
    });

    await assert.rejects(
      () => commitPreparedAgents(prepared),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        // The bridge MUST use appendLeaks (not ManualRecoveryError) on the
        // commit-path catch.
        assert.ok(
          err.name !== "ManualRecoveryError",
          "commit catch must NOT use ManualRecoveryError",
        );
        // The rollback leak must appear in the user-visible message.
        assert.match(
          err.message,
          /\(additionally: failed to roll back agent rename/,
          `expected appendLeaks rollback chain in message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});

// TR-06 orphan tolerance in replacePreparedAgents -----------------------

test("TR-06 replacePreparedAgents tolerates owned orphan file from prior partial install", async () => {
  // A previous partial install left an orphan agent file at the target.
  // Because the basename matches an owned previous entry's generatedName,
  // the 3-arm policy pre-removes the orphan via removeOrphanIfPresent and
  // proceeds with the rename. The new staged content lands.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Step 1: do a normal commit so the agents-index records the previous
    // generatedNames (acme-helper + bot). After commit, the target files
    // exist on disk and the index lists their entries.
    const first = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    await commitPreparedAgents(first);

    // Step 2: out-of-band, replace the bot target file with orphan bytes
    // (simulating a prior partial install having left a file at the same
    // basename). The orphan body carries the generated-agent marker so
    // the AG-5 foreign-content check still classifies it as owned and the
    // replace path proceeds. The index still claims ownership of this
    // generatedName.
    const orphanTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    await rm(orphanTarget, { force: true });
    await writeFile(
      orphanTarget,
      "---\nname: pi-claude-marketplace-acme-bot\n---\norphan-agent generated by pi-claude-marketplace\n",
      "utf8",
    );

    // Step 3: re-prepare + replace. The replace path's backup loop sees
    // the file at orphanTarget (basename "pi-claude-marketplace-acme-bot"
    // IS in ownedNames), backs it up, then proceeds. The new content
    // lands; orphan bytes are gone.
    const second = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });

    const replacement = await replacePreparedAgents(second);
    assert.equal(replacement.kind, "replaced");

    const replacedBody = await readFile(orphanTarget, "utf8");
    assert.ok(
      !replacedBody.includes("orphan-agent"),
      "orphan-agent bytes must be gone after replace",
    );
    // The new agent body must carry the generated marker (this is
    // the regenerated content, not the orphan).
    assert.ok(
      replacedBody.includes("generated by pi-claude-marketplace"),
      "replacement body must carry the V1 generated marker",
    );
  });
});

// TR-07 step-1 ENOENT-tolerance regression test ----------------

test("TR-07 commitPreparedAgents step-1 ENOENT-tolerance enables retry-safe self-heal", async () => {
  // A previous commit landed the bot target file, but partial-commit drift
  // (e.g., an out-of-band cleanup or a crash between file delete and index
  // save) removed the on-disk file while the index still references the
  // OLD targetPath. On the next prepare + commit cycle, step 1 attempts
  // `rm` on the already-gone target; the ENOENT swallow lets step 2 proceed
  // with the new rename. Final disk state is clean: the bot file is at its
  // target exactly once, the index reflects truth, and the second staging
  // dir is cleaned up. This test asserts ONLY the final state -- it does
  // NOT spy on rm calls, count Promise.all iterations, or otherwise pin
  // implementation details.
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Cycle 1: full prepare + commit.
    const prepared1 = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared1.kind, "staged");
    await commitPreparedAgents(prepared1);

    // Inject partial-commit drift: the bot target file is gone, but the
    // index still references its targetPath. Step-1 ENOENT-tolerance is
    // designed to self-heal exactly this scenario.
    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    assert.ok(await pathExists(targetPath), "expected cycle-1 commit to land bot.md");
    await rm(targetPath);

    // Cycle 2: re-prepare + commit. Step 1 attempts `rm` on the
    // already-gone target; the ENOENT swallow lets step 2 proceed.
    const prepared2 = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared2.kind, "staged");
    await commitPreparedAgents(prepared2);

    // Behavior assertion: final disk + index state is clean.
    assert.ok(await pathExists(targetPath), "bot.md must exist at target after retry");
    const indexJson = JSON.parse(await readFile(locations.agentsIndexPath, "utf8")) as AgentsIndex;
    assert.equal(
      indexJson.agents.filter((a) => a.generatedName === "pi-claude-marketplace-acme-bot").length,
      1,
      "index has exactly one row for the bot agent after retry",
    );
    assert.equal(
      prepared2.kind === "staged" ? await pathExists(prepared2.stagingDir) : true,
      false,
      "staging dir cleaned up after retry",
    );
  });
});
