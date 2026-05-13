import assert from "node:assert/strict";
import test from "node:test";

import {
  findOwnershipConflicts,
  partitionByOwner,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts";

import type { AgentsIndexEntry } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

// AG-3 partition + AG-9 cross-owner conflict detection. Pure in-memory.

function makeEntry(overrides: Partial<AgentsIndexEntry> = {}): AgentsIndexEntry {
  return {
    plugin: overrides.plugin ?? "acme",
    marketplace: overrides.marketplace ?? "mp1",
    sourceAgent: overrides.sourceAgent ?? "bot",
    generatedName: overrides.generatedName ?? "pi-claude-marketplace-acme-bot",
    sourcePath: overrides.sourcePath ?? "/abs/source.md",
    targetPath: overrides.targetPath ?? "/abs/target.md",
    sourceHash: overrides.sourceHash ?? "abc",
    droppedFields: overrides.droppedFields ?? [],
    droppedTools: overrides.droppedTools ?? [],
    warnings: overrides.warnings ?? [],
    ...(overrides.originalModel !== undefined ? { originalModel: overrides.originalModel } : {}),
  };
}

test("AG-3 partitionByOwner separates entries by (mp, plugin) tuple", () => {
  const entries: AgentsIndexEntry[] = [
    makeEntry({ marketplace: "mp1", plugin: "acme", generatedName: "a" }),
    makeEntry({ marketplace: "mp1", plugin: "other", generatedName: "b" }),
    makeEntry({ marketplace: "mp2", plugin: "acme", generatedName: "c" }),
    makeEntry({ marketplace: "mp1", plugin: "acme", generatedName: "d" }),
  ];

  const { previous, other } = partitionByOwner(entries, "mp1", "acme");
  assert.deepEqual(
    previous.map((e) => e.generatedName),
    ["a", "d"],
  );
  assert.deepEqual(
    other.map((e) => e.generatedName),
    ["b", "c"],
  );
});

test("AG-3 partitionByOwner returns frozen arrays (defense-in-depth)", () => {
  const { previous, other } = partitionByOwner(
    [makeEntry({ marketplace: "mp1", plugin: "acme" })],
    "mp1",
    "acme",
  );
  assert.ok(Object.isFrozen(previous));
  assert.ok(Object.isFrozen(other));
});

test("AG-3 partitionByOwner returns [] previous + all other when no entries match", () => {
  const entries = [makeEntry({ marketplace: "mp1", plugin: "other" })];
  const { previous, other } = partitionByOwner(entries, "mp1", "acme");
  assert.equal(previous.length, 0);
  assert.equal(other.length, 1);
});

test("AG-9 findOwnershipConflicts returns single-name conflict", () => {
  const owner = makeEntry({
    marketplace: "mp2",
    plugin: "rival",
    generatedName: "pi-claude-marketplace-acme-bot",
  });
  const conflicts = findOwnershipConflicts([owner], ["pi-claude-marketplace-acme-bot"]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.generatedName, "pi-claude-marketplace-acme-bot");
  assert.equal(conflicts[0]?.owner.plugin, "rival");
});

test("AG-9 findOwnershipConflicts returns multi-name conflict in input order", () => {
  const others: AgentsIndexEntry[] = [
    makeEntry({ generatedName: "x" }),
    makeEntry({ generatedName: "y" }),
    makeEntry({ generatedName: "z" }),
  ];
  // Pass next in order [z, x, y] -- conflict array should match.
  const conflicts = findOwnershipConflicts(others, ["z", "x", "y"]);
  assert.deepEqual(
    conflicts.map((c) => c.generatedName),
    ["z", "x", "y"],
  );
});

test("AG-9 findOwnershipConflicts returns [] when no overlap", () => {
  const others = [makeEntry({ generatedName: "owned" })];
  const conflicts = findOwnershipConflicts(others, ["new1", "new2"]);
  assert.equal(conflicts.length, 0);
});

test("AG-9 findOwnershipConflicts deduplicates by generatedName via the otherByName map (last-win behavior)", () => {
  // If the otherEntries somehow contained two rows with the same name (which
  // shouldn't happen because the index validator forbids duplicate generated
  // names within a stage, but we test the helper's behavior anyway), the
  // last-seen wins and we still surface the conflict.
  const others: AgentsIndexEntry[] = [
    makeEntry({ generatedName: "dup", plugin: "a" }),
    makeEntry({ generatedName: "dup", plugin: "b" }),
  ];
  const conflicts = findOwnershipConflicts(others, ["dup"]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.owner.plugin, "b");
});
