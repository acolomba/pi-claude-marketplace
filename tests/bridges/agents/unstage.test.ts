import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/claude-marketplace/bridges/agents/marker.ts";
import { unstagePluginAgents } from "../../../extensions/claude-marketplace/bridges/agents/unstage.ts";
import { loadAgentsIndex } from "../../../extensions/claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";
import { atomicWriteJson } from "../../../extensions/claude-marketplace/shared/atomic-json.ts";
import {
  cleanupStaging,
  pathExists,
} from "../../../extensions/claude-marketplace/shared/fs-utils.ts";

import type { AgentsIndex } from "../../../extensions/claude-marketplace/persistence/agents-index-schema.ts";

// AG-3 / AG-5 unstage: foreign-content soft-fail preserves index row;
// happy path removes file + drops row; ENOENT-tolerant (idempotent retry).

async function withTmpScope<T>(
  fn: (ctx: { scopeRoot: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "agents-unstage-"));
  const locations = locationsFor("project", tmp);
  try {
    return await fn({ scopeRoot: tmp, locations });
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
}

function makeOwnedFileContent(name: string): string {
  // Minimum viable owned file: basename starts with claude-marketplace- (we
  // place at the right path), body contains the marker substring.
  return (
    "---\n" +
    `name: ${name}\n` +
    "tools: read\n" +
    "---\n\n" +
    `<!--\n${GENERATED_AGENT_MARKER}\n-->\n\nBody.\n`
  );
}

test("unstagePluginAgents removes owned files and updates index (happy path)", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(locations.agentsDir, { recursive: true });
    const a = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-bot.md");
    const b = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-helper.md");
    await writeFile(a, makeOwnedFileContent("claude-marketplace-acme-bot"));
    await writeFile(b, makeOwnedFileContent("claude-marketplace-acme-helper"));

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "bot",
          generatedName: "claude-marketplace-acme-bot",
          sourcePath: "/orig/bot.md",
          targetPath: a,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "helper",
          generatedName: "claude-marketplace-acme-helper",
          sourcePath: "/orig/helper.md",
          targetPath: b,
          sourceHash: "def",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });
    assert.deepEqual([...result.removedNames].sort(), [
      "claude-marketplace-acme-bot",
      "claude-marketplace-acme-helper",
    ]);
    assert.equal(result.failed.length, 0);

    // Files gone, index empty for this (mp,plugin).
    assert.equal(await pathExists(a), false);
    assert.equal(await pathExists(b), false);
    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 0);
  });
});

test("AG-3 unstage of plugin X in mp1 leaves plugin X in mp2 rows untouched", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(locations.agentsDir, { recursive: true });
    const mp1Target = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-bot.md");
    const mp2Target = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-mp2only.md");
    await writeFile(mp1Target, makeOwnedFileContent("claude-marketplace-acme-bot"));
    await writeFile(mp2Target, makeOwnedFileContent("claude-marketplace-acme-mp2only"));

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "bot",
          generatedName: "claude-marketplace-acme-bot",
          sourcePath: "/orig/bot.md",
          targetPath: mp1Target,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "acme",
          marketplace: "mp2",
          sourceAgent: "mp2only",
          generatedName: "claude-marketplace-acme-mp2only",
          sourcePath: "/orig/mp2only.md",
          targetPath: mp2Target,
          sourceHash: "def",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    await unstagePluginAgents({ locations, marketplaceName: "mp1", pluginName: "acme" });

    // mp1 file gone; mp2 file untouched.
    assert.equal(await pathExists(mp1Target), false);
    assert.equal(await pathExists(mp2Target), true);
    const mp2BytesAfter = await readFile(mp2Target, "utf8");
    assert.ok(mp2BytesAfter.includes(GENERATED_AGENT_MARKER));

    // Index has only mp2's row left.
    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 1);
    assert.equal(after.agents[0]?.marketplace, "mp2");
  });
});

test("AG-5 unstage SOFT-FAILS on foreign content (basename mismatch)", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(locations.agentsDir, { recursive: true });
    // Index points at a foreign path (no claude-marketplace- prefix).
    const foreignTarget = path.join(locations.agentsDir, "foreign.md");
    await writeFile(foreignTarget, "---\nname: foreign\n---\nbody\n");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "ghost",
          generatedName: "claude-marketplace-acme-ghost",
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

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });

    assert.equal(result.removedNames.length, 0);
    assert.equal(result.failed.length, 1);
    assert.match(result.failed[0]?.reason ?? "", /does not start with/);

    // Foreign file untouched.
    assert.equal(await pathExists(foreignTarget), true);

    // Index row PRESERVED.
    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 1);
    assert.equal(after.agents[0]?.generatedName, "claude-marketplace-acme-ghost");
  });
});

test("AG-5 unstage SOFT-FAILS on foreign content (marker missing)", async () => {
  await withTmpScope(async ({ locations }) => {
    await mkdir(locations.agentsDir, { recursive: true });
    // Right basename, body lacks marker.
    const target = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-ghost.md");
    await writeFile(target, "---\nname: ghost\n---\nno marker here\n");

    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "ghost",
          generatedName: "claude-marketplace-acme-ghost",
          sourcePath: "/orig/ghost.md",
          targetPath: target,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });

    assert.equal(result.removedNames.length, 0);
    assert.equal(result.failed.length, 1);
    assert.match(result.failed[0]?.reason ?? "", /missing the generated marker/);

    assert.equal(await pathExists(target), true);
    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 1);
  });
});

test("unstagePluginAgents tolerates ENOENT on target file (treats as removed)", async () => {
  await withTmpScope(async ({ locations }) => {
    // Index claims a row but file is missing on disk.
    const phantom = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-phantom.md");
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "phantom",
          generatedName: "claude-marketplace-acme-phantom",
          sourcePath: "/orig/phantom.md",
          targetPath: phantom,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });
    assert.deepEqual([...result.removedNames], ["claude-marketplace-acme-phantom"]);
    assert.equal(result.failed.length, 0);

    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 0);
  });
});

test("unstagePluginAgents returns empty arrays when no matching entries", async () => {
  await withTmpScope(async ({ locations }) => {
    // Seed index with rows for mp2/other -- unstage(mp1, acme) finds nothing.
    const seed: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "other",
          marketplace: "mp2",
          sourceAgent: "x",
          generatedName: "claude-marketplace-other-x",
          sourcePath: "/orig/x.md",
          targetPath: path.join(locations.agentsDir, "claude-marketplace-other-x.md"),
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await atomicWriteJson(locations.agentsIndexPath, seed);

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });
    assert.equal(result.removedNames.length, 0);
    assert.equal(result.failed.length, 0);

    // Other rows survive.
    const after = await loadAgentsIndex(locations);
    assert.equal(after.agents.length, 1);
  });
});

test("unstagePluginAgents returns corruptions in warnings[] when index has per-row corruption", async () => {
  await withTmpScope(async ({ locations }) => {
    // Hand-craft an index file with ONE valid row + ONE corrupt row
    // (missing required field). The valid row is for our (mp,plugin) and
    // points at a file with no marker so it soft-fails; the corrupt row is
    // dropped at load time and surfaces in corruptions[].
    await mkdir(locations.agentsDir, { recursive: true });
    const validTarget = path.join(locations.agentsDir, GENERATED_AGENT_PREFIX + "acme-bot.md");
    await writeFile(validTarget, makeOwnedFileContent("claude-marketplace-acme-bot"));

    const onDisk = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "bot",
          generatedName: "claude-marketplace-acme-bot",
          sourcePath: "/orig/bot.md",
          targetPath: validTarget,
          sourceHash: "abc",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        // Missing required `targetPath`.
        {
          plugin: "acme",
          marketplace: "mp1",
          sourceAgent: "broken",
          generatedName: "claude-marketplace-acme-broken",
          sourcePath: "/orig/broken.md",
          sourceHash: "def",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    // Use atomicWriteJson to bypass schema check (it would otherwise refuse).
    await atomicWriteJson(locations.agentsIndexPath, onDisk);

    const result = await unstagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
    });

    assert.ok(
      result.warnings.some((w) => w.includes("schema validation")),
      "expected per-row corruption surfaced in warnings",
    );
  });
});
