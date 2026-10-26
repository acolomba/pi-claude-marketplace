import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AGENTS_INDEX_ENTRY_VALIDATOR,
  AGENTS_INDEX_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

import type {
  AgentsIndex,
  AgentsIndexEntry,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

void ({
  plugin: "typed-plugin",
  marketplace: "typed-marketplace",
  sourceAgent: "typed-agent",
  generatedName: "typed-marketplace-typed-plugin-typed-agent",
  sourcePath: "/plugins/typed-plugin/agents/typed-agent.md",
  targetPath: "/scope/agents/typed-marketplace-typed-plugin-typed-agent.md",
  sourceHash: "typed-source-hash",
  originalModel: "sonnet",
  droppedFields: ["permissionMode"],
  droppedTools: ["NotebookEdit"],
  warnings: ["unsupported tool dropped"],
} satisfies AgentsIndexEntry);

void ({
  schemaVersion: 1,
  agents: [
    {
      plugin: "typed-plugin",
      marketplace: "typed-marketplace",
      sourceAgent: "typed-agent",
      generatedName: "typed-marketplace-typed-plugin-typed-agent",
      sourcePath: "/plugins/typed-plugin/agents/typed-agent.md",
      targetPath: "/scope/agents/typed-marketplace-typed-plugin-typed-agent.md",
      sourceHash: "typed-source-hash",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
  ],
} satisfies AgentsIndex);

// @ts-expect-error an agents index has schema version 1
void (2 satisfies AgentsIndex["schemaVersion"]);
// @ts-expect-error a generated name is required on every agents-index row
void ({} satisfies Pick<AgentsIndexEntry, "generatedName">);
// @ts-expect-error the optional original model is a string when present
void (42 satisfies AgentsIndexEntry["originalModel"]);

describe("AGENTS_INDEX_ENTRY_VALIDATOR", () => {
  test("accepts every required row field and the optional original model", () => {
    // arrange
    const completeEntry = {
      plugin: "alpha-plugin",
      marketplace: "alpha-marketplace",
      sourceAgent: "reviewer",
      generatedName: "alpha-marketplace-alpha-plugin-reviewer",
      sourcePath: "/plugins/alpha-plugin/agents/reviewer.md",
      targetPath: "/scope/agents/alpha-marketplace-alpha-plugin-reviewer.md",
      sourceHash: "alpha-source-hash",
      originalModel: "opus",
      droppedFields: ["permissionMode"],
      droppedTools: ["NotebookRead"],
      warnings: ["unsupported field dropped"],
    };

    // act
    const isAccepted = AGENTS_INDEX_ENTRY_VALIDATOR.Check(completeEntry);

    // assert
    assert.strictEqual(isAccepted, true);
  });

  test("accepts a complete row without the optional original model", () => {
    // arrange
    const completeEntry = {
      plugin: "beta-plugin",
      marketplace: "beta-marketplace",
      sourceAgent: "planner",
      generatedName: "beta-marketplace-beta-plugin-planner",
      sourcePath: "/plugins/beta-plugin/agents/planner.md",
      targetPath: "/scope/agents/beta-marketplace-beta-plugin-planner.md",
      sourceHash: "beta-source-hash",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    };

    // act
    const isAccepted = AGENTS_INDEX_ENTRY_VALIDATOR.Check(completeEntry);

    // assert
    assert.strictEqual(isAccepted, true);
  });

  for (const { invalidField, invalidEntry } of [
    {
      invalidField: "a non-string plugin",
      invalidEntry: {
        plugin: 42,
        marketplace: "invalid-plugin-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-plugin-marketplace-reviewer",
        sourcePath: "/plugins/invalid-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-plugin-marketplace-reviewer.md",
        sourceHash: "invalid-plugin-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a non-string marketplace",
      invalidEntry: {
        plugin: "invalid-marketplace-plugin",
        marketplace: 42,
        sourceAgent: "reviewer",
        generatedName: "invalid-marketplace-plugin-reviewer",
        sourcePath: "/plugins/invalid-marketplace-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-marketplace-plugin-reviewer.md",
        sourceHash: "invalid-marketplace-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a non-string source agent",
      invalidEntry: {
        plugin: "invalid-source-agent-plugin",
        marketplace: "invalid-source-agent-marketplace",
        sourceAgent: 42,
        generatedName: "invalid-source-agent-generated-name",
        sourcePath: "/plugins/invalid-source-agent-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-source-agent-generated-name.md",
        sourceHash: "invalid-source-agent-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a missing generated name",
      invalidEntry: {
        plugin: "missing-generated-name-plugin",
        marketplace: "missing-generated-name-marketplace",
        sourceAgent: "reviewer",
        sourcePath: "/plugins/missing-generated-name-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/missing-generated-name-reviewer.md",
        sourceHash: "missing-generated-name-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a non-string source path",
      invalidEntry: {
        plugin: "invalid-source-path-plugin",
        marketplace: "invalid-source-path-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-source-path-reviewer",
        sourcePath: 42,
        targetPath: "/scope/agents/invalid-source-path-reviewer.md",
        sourceHash: "invalid-source-path-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a non-string target path",
      invalidEntry: {
        plugin: "invalid-target-path-plugin",
        marketplace: "invalid-target-path-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-target-path-reviewer",
        sourcePath: "/plugins/invalid-target-path-plugin/agents/reviewer.md",
        targetPath: 42,
        sourceHash: "invalid-target-path-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "a non-string source hash",
      invalidEntry: {
        plugin: "invalid-source-hash-plugin",
        marketplace: "invalid-source-hash-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-source-hash-reviewer",
        sourcePath: "/plugins/invalid-source-hash-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-source-hash-reviewer.md",
        sourceHash: 42,
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "non-array dropped fields",
      invalidEntry: {
        plugin: "invalid-dropped-fields-plugin",
        marketplace: "invalid-dropped-fields-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-dropped-fields-reviewer",
        sourcePath: "/plugins/invalid-dropped-fields-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-dropped-fields-reviewer.md",
        sourceHash: "invalid-dropped-fields-source-hash",
        droppedFields: "permissionMode",
        droppedTools: [],
        warnings: [],
      },
    },
    {
      invalidField: "non-array dropped tools",
      invalidEntry: {
        plugin: "invalid-dropped-tools-plugin",
        marketplace: "invalid-dropped-tools-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-dropped-tools-reviewer",
        sourcePath: "/plugins/invalid-dropped-tools-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-dropped-tools-reviewer.md",
        sourceHash: "invalid-dropped-tools-source-hash",
        droppedFields: [],
        droppedTools: "NotebookEdit",
        warnings: [],
      },
    },
    {
      invalidField: "non-array warnings",
      invalidEntry: {
        plugin: "invalid-warnings-plugin",
        marketplace: "invalid-warnings-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-warnings-reviewer",
        sourcePath: "/plugins/invalid-warnings-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-warnings-reviewer.md",
        sourceHash: "invalid-warnings-source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: "unsupported field dropped",
      },
    },
    {
      invalidField: "a non-string original model",
      invalidEntry: {
        plugin: "invalid-original-model-plugin",
        marketplace: "invalid-original-model-marketplace",
        sourceAgent: "reviewer",
        generatedName: "invalid-original-model-reviewer",
        sourcePath: "/plugins/invalid-original-model-plugin/agents/reviewer.md",
        targetPath: "/scope/agents/invalid-original-model-reviewer.md",
        sourceHash: "invalid-original-model-source-hash",
        originalModel: 42,
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    },
  ]) {
    test(`rejects a row with ${invalidField}`, () => {
      // arrange
      const rejectedEntry = invalidEntry;

      // act
      const isAccepted = AGENTS_INDEX_ENTRY_VALIDATOR.Check(rejectedEntry);

      // assert
      assert.strictEqual(isAccepted, false);
    });
  }
});

describe("AGENTS_INDEX_VALIDATOR", () => {
  test("accepts a version 1 document with an empty agents array", () => {
    // arrange
    const emptyIndex = { schemaVersion: 1, agents: [] };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(emptyIndex);

    // assert
    assert.strictEqual(isAccepted, true);
  });

  test("accepts a version 1 document with several complete agents", () => {
    // arrange
    const populatedIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "gamma-plugin",
          marketplace: "gamma-marketplace",
          sourceAgent: "architect",
          generatedName: "gamma-marketplace-gamma-plugin-architect",
          sourcePath: "/plugins/gamma-plugin/agents/architect.md",
          targetPath: "/scope/agents/gamma-marketplace-gamma-plugin-architect.md",
          sourceHash: "gamma-source-hash",
          originalModel: "haiku",
          droppedFields: ["color"],
          droppedTools: ["WebSearch"],
          warnings: ["unsupported model mapped"],
        },
        {
          plugin: "delta-plugin",
          marketplace: "delta-marketplace",
          sourceAgent: "implementer",
          generatedName: "delta-marketplace-delta-plugin-implementer",
          sourcePath: "/plugins/delta-plugin/agents/implementer.md",
          targetPath: "/scope/agents/delta-marketplace-delta-plugin-implementer.md",
          sourceHash: "delta-source-hash",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(populatedIndex);

    // assert
    assert.strictEqual(isAccepted, true);
  });

  test("rejects adjacent schema version 2", () => {
    // arrange
    const adjacentVersionIndex = { schemaVersion: 2, agents: [] };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(adjacentVersionIndex);

    // assert
    assert.strictEqual(isAccepted, false);
  });

  test("rejects entries in place of the agents envelope field", () => {
    // arrange
    const renamedEnvelope = { schemaVersion: 1, entries: [] };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(renamedEnvelope);

    // assert
    assert.strictEqual(isAccepted, false);
  });

  for (const { envelopeKind, malformedIndex } of [
    { envelopeKind: "null", malformedIndex: null },
    { envelopeKind: "a string primitive", malformedIndex: "agents" },
    { envelopeKind: "a number primitive", malformedIndex: 1 },
    { envelopeKind: "a boolean primitive", malformedIndex: true },
    { envelopeKind: "an array", malformedIndex: [] },
  ]) {
    test(`rejects ${envelopeKind} as the document envelope`, () => {
      // arrange
      const rejectedIndex = malformedIndex;

      // act
      const isAccepted = AGENTS_INDEX_VALIDATOR.Check(rejectedIndex);

      // assert
      assert.strictEqual(isAccepted, false);
    });
  }

  test("rejects a non-array agents envelope field", () => {
    // arrange
    const malformedIndex = { schemaVersion: 1, agents: {} };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(malformedIndex);

    // assert
    assert.strictEqual(isAccepted, false);
  });

  test("rejects a document containing an incomplete agent row", () => {
    // arrange
    const incompleteIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "incomplete-plugin",
          marketplace: "incomplete-marketplace",
          sourceAgent: "reviewer",
          sourcePath: "/plugins/incomplete-plugin/agents/reviewer.md",
          targetPath: "/scope/agents/incomplete-reviewer.md",
          sourceHash: "incomplete-source-hash",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };

    // act
    const isAccepted = AGENTS_INDEX_VALIDATOR.Check(incompleteIndex);

    // assert
    assert.strictEqual(isAccepted, false);
  });
});
