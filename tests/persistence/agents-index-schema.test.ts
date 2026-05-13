import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENTS_INDEX_ENTRY_VALIDATOR,
  AGENTS_INDEX_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

/**
 * AG-2 -- agents-index.json schema acceptance/rejection cases.
 *
 * The validator runs at load + save sites; these tests pin the
 * acceptance/rejection contract independently of the IO layer.
 * Test names prefixed with REQ-IDs (Phase 2 convention -- grep-able).
 */

const VALID_ROW = {
  plugin: "acme",
  marketplace: "test-mp",
  sourceAgent: "bot",
  generatedName: "pi-claude-marketplace-acme-bot",
  sourcePath: "/abs/path/to/source/agents/bot.md",
  targetPath: "/abs/path/to/scope/agents/pi-claude-marketplace-acme-bot.md",
  sourceHash: "deadbeef",
  originalModel: "sonnet",
  droppedFields: [],
  droppedTools: [],
  warnings: [],
};

test("AG-2 AGENTS_INDEX_VALIDATOR.Check accepts a valid empty index", () => {
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 1, agents: [] }), true);
});

test("AG-2 AGENTS_INDEX_VALIDATOR.Check accepts a valid single-row index with all fields", () => {
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 1, agents: [VALID_ROW] }), true);
});

test("AG-2 AGENTS_INDEX_VALIDATOR.Check accepts a row WITHOUT optional originalModel", () => {
  const rowNoModel = {
    plugin: VALID_ROW.plugin,
    marketplace: VALID_ROW.marketplace,
    sourceAgent: VALID_ROW.sourceAgent,
    generatedName: VALID_ROW.generatedName,
    sourcePath: VALID_ROW.sourcePath,
    targetPath: VALID_ROW.targetPath,
    sourceHash: VALID_ROW.sourceHash,
    droppedFields: [],
    droppedTools: [],
    warnings: [],
  };
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 1, agents: [rowNoModel] }), true);
});

test("AG-2 AGENTS_INDEX_VALIDATOR.Check rejects a row missing required field generatedName", () => {
  const rowBad = { ...VALID_ROW } as Record<string, unknown>;
  delete rowBad.generatedName;
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 1, agents: [rowBad] }), false);
});

test("AG-2 AGENTS_INDEX_VALIDATOR.Check rejects a doc with schemaVersion: 2", () => {
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 2, agents: [] }), false);
});

test("AG-2 AGENTS_INDEX_VALIDATOR.Check rejects a doc with field name 'entries' instead of 'agents' (V1 wire-shape preservation)", () => {
  // Forward-defense: if someone refactors the schema to `entries:` it
  // breaks the V1 on-disk contract. This test catches that regression.
  assert.equal(AGENTS_INDEX_VALIDATOR.Check({ schemaVersion: 1, entries: [] }), false);
});

test("AG-2 AGENTS_INDEX_ENTRY_VALIDATOR.Check accepts a single row in isolation", () => {
  // Used by loadAgentsIndex per-row validation.
  assert.equal(AGENTS_INDEX_ENTRY_VALIDATOR.Check(VALID_ROW), true);
});
