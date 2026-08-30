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
});
