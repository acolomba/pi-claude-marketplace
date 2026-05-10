import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadAgentsIndex,
  saveAgentsIndex,
} from "../../extensions/claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../extensions/claude-marketplace/persistence/locations.ts";

import type { AgentsIndex } from "../../extensions/claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../extensions/claude-marketplace/persistence/locations.ts";

/**
 * AG-2 / AG-4 -- agents-index.json load/save behavior.
 *
 * Each test creates an isolated tmpdir representing the project-scope
 * cwd; `locationsFor("project", cwd)` produces a fully-realized
 * ScopedLocations whose `extensionRoot` lands under that tmpdir. That
 * keeps the tests free of any reliance on Plan 03-01's pending
 * `agentsIndexPath` field -- the IO layer derives the path from
 * `extensionRoot` (see implementation note in agents-index-io.ts).
 *
 * Test names prefixed with REQ-IDs (Phase 2 convention -- grep-able).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/agents-index");

interface TmpScope {
  loc: ScopedLocations;
  indexPath: string;
  cleanup: () => Promise<void>;
}

async function tmpScope(): Promise<TmpScope> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-agents-index-test-"));
  // locationsFor("project", cwd) -> extensionRoot = <cwd>/.pi/claude-marketplace
  const loc = locationsFor("project", dir);
  // Pre-create extensionRoot so single-row + corruption fixtures can be
  // written without mkdir-on-each-test boilerplate. The "creates parent
  // dirs" test deliberately uses a fresh dir without pre-creating, so it
  // skips this helper.
  await mkdir(loc.extensionRoot, { recursive: true });
  const indexPath = path.join(loc.extensionRoot, "agents-index.json");
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };

  return { loc, indexPath, cleanup };
}

/**
 * Variant that does NOT pre-create extensionRoot. Used to verify
 * saveAgentsIndex creates parent dirs (atomicWriteJson contract).
 */
async function bareTmpScope(): Promise<TmpScope> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-agents-index-test-bare-"));
  const loc = locationsFor("project", dir);
  const indexPath = path.join(loc.extensionRoot, "agents-index.json");
  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };

  return { loc, indexPath, cleanup };
}

test("AG-2 loadAgentsIndex returns empty {schemaVersion:1, agents:[], corruptions:[]} when file is missing (ENOENT)", async () => {
  const { loc, cleanup } = await tmpScope();
  try {
    const got = await loadAgentsIndex(loc);
    assert.equal(got.schemaVersion, 1);
    assert.deepEqual([...got.agents], []);
    assert.deepEqual([...got.corruptions], []);
  } finally {
    await cleanup();
  }
});

test("AG-2 loadAgentsIndex round-trips a single-row index from the single-row.json fixture", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await copyFile(path.join(FIXTURES, "single-row.json"), indexPath);
    const got = await loadAgentsIndex(loc);
    assert.equal(got.schemaVersion, 1);
    assert.equal(got.agents.length, 1);
    assert.equal(got.agents[0]?.plugin, "acme");
    assert.equal(got.agents[0]?.generatedName, "claude-marketplace-acme-bot");
    assert.equal(got.agents[0]?.originalModel, "sonnet");
    assert.deepEqual([...got.corruptions], []);
  } finally {
    await cleanup();
  }
});

test("AG-4 loadAgentsIndex throws when JSON is unparseable", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await writeFile(indexPath, "not json");
    await assert.rejects(
      () => loadAgentsIndex(loc),
      (err: unknown) =>
        err instanceof Error && err.message.includes("Failed to parse agents-index"),
    );
  } finally {
    await cleanup();
  }
});

test("AG-4 loadAgentsIndex throws when schemaVersion is missing", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await copyFile(path.join(FIXTURES, "file-level-corruption.json"), indexPath);
    await assert.rejects(
      () => loadAgentsIndex(loc),
      (err: unknown) => err instanceof Error && err.message.includes("expected schemaVersion 1"),
    );
  } finally {
    await cleanup();
  }
});

test("AG-4 loadAgentsIndex throws when schemaVersion != 1", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await writeFile(indexPath, JSON.stringify({ schemaVersion: 2, agents: [] }));
    await assert.rejects(
      () => loadAgentsIndex(loc),
      (err: unknown) => err instanceof Error && err.message.includes("expected schemaVersion 1"),
    );
  } finally {
    await cleanup();
  }
});

test("AG-4 loadAgentsIndex throws when 'agents' field is not an array", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await writeFile(indexPath, JSON.stringify({ schemaVersion: 1, agents: "not-array" }));
    await assert.rejects(
      () => loadAgentsIndex(loc),
      (err: unknown) =>
        err instanceof Error && err.message.includes("'agents' field must be an array"),
    );
  } finally {
    await cleanup();
  }
});

test("AG-4 loadAgentsIndex DROPS per-row corruption and surfaces in corruptions[]", async () => {
  const { loc, indexPath, cleanup } = await tmpScope();
  try {
    await copyFile(path.join(FIXTURES, "per-row-corruption.json"), indexPath);
    const got = await loadAgentsIndex(loc);
    // Row 0 is valid, row 1 missing generatedName -- the bad row drops.
    assert.equal(got.agents.length, 1);
    assert.equal(got.agents[0]?.sourceAgent, "bot");
    assert.equal(got.corruptions.length, 1);
    assert.match(got.corruptions[0]!, /agents\[1\]/);
  } finally {
    await cleanup();
  }
});

test("AG-2 saveAgentsIndex round-trips: save then load returns same agents", async () => {
  const { loc, cleanup } = await tmpScope();
  try {
    const index: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "p",
          marketplace: "m",
          sourceAgent: "s",
          generatedName: "claude-marketplace-p-s",
          sourcePath: "/src",
          targetPath: "/dst",
          sourceHash: "abc123",
          droppedFields: [],
          droppedTools: [],
          warnings: ["a warning"],
        },
      ],
    };
    await saveAgentsIndex(loc, index);
    const got = await loadAgentsIndex(loc);
    assert.equal(got.schemaVersion, 1);
    assert.equal(got.agents.length, 1);
    assert.equal(got.agents[0]?.plugin, "p");
    assert.deepEqual([...(got.agents[0]?.warnings ?? [])], ["a warning"]);
    assert.deepEqual([...got.corruptions], []);
  } finally {
    await cleanup();
  }
});

test("AG-4 saveAgentsIndex throws on schema-invalid input", async () => {
  const { loc, cleanup } = await tmpScope();
  try {
    // schemaVersion 2 is not Literal(1) -> validator rejects.
    const bad = { schemaVersion: 2, agents: [] } as unknown as AgentsIndex;
    await assert.rejects(
      () => saveAgentsIndex(loc, bad),
      (err: unknown) => err instanceof Error && err.message.includes("saveAgentsIndex refused"),
    );
  } finally {
    await cleanup();
  }
});

test("AG-2 saveAgentsIndex creates parent dirs (extensionRoot may not yet exist)", async () => {
  const { loc, indexPath, cleanup } = await bareTmpScope();
  try {
    const index: AgentsIndex = { schemaVersion: 1, agents: [] };
    await saveAgentsIndex(loc, index);
    // If the parent dir wasn't created, the read would ENOENT.
    const text = await readFile(indexPath, "utf8");
    const parsed: unknown = JSON.parse(text);
    assert.deepEqual(parsed, { schemaVersion: 1, agents: [] });
  } finally {
    await cleanup();
  }
});
