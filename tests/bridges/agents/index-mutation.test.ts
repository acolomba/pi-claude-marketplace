import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { partitionByOwner } from "../../../extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts";

import type { AgentsIndexEntry } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

describe("partitionByOwner", () => {
  test("partitions exact owners without disturbing other owners or input order", () => {
    // arrange
    const entries: AgentsIndexEntry[] = [
      {
        plugin: "target-plugin",
        marketplace: "target-marketplace",
        sourceAgent: "owned-first",
        generatedName: "shared-name",
        sourcePath: "/plugins/target/agents/owned-first.md",
        targetPath: "/pi/agents/shared-name.md",
        sourceHash: "owned-first-hash",
        originalModel: "sonnet",
        droppedFields: ["permissionMode"],
        droppedTools: ["NotebookEdit"],
        warnings: ["owned first warning"],
      },
      {
        plugin: "other-plugin",
        marketplace: "target-marketplace",
        sourceAgent: "same-marketplace",
        generatedName: "other-plugin-name",
        sourcePath: "/plugins/other/agents/same-marketplace.md",
        targetPath: "/pi/agents/other-plugin-name.md",
        sourceHash: "same-marketplace-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      {
        plugin: "target-plugin",
        marketplace: "other-marketplace",
        sourceAgent: "same-plugin",
        generatedName: "other-marketplace-name",
        sourcePath: "/plugins/target-other/agents/same-plugin.md",
        targetPath: "/pi/agents/other-marketplace-name.md",
        sourceHash: "same-plugin-hash",
        originalModel: "opus",
        droppedFields: ["hooks"],
        droppedTools: [],
        warnings: ["other marketplace warning"],
      },
      {
        plugin: "foreign-plugin",
        marketplace: "foreign-marketplace",
        sourceAgent: "foreign-agent",
        generatedName: "foreign-name",
        sourcePath: "/plugins/foreign/agents/foreign-agent.md",
        targetPath: "/pi/agents/foreign-name.md",
        sourceHash: "foreign-hash",
        droppedFields: [],
        droppedTools: ["Task"],
        warnings: [],
      },
      {
        plugin: "target-plugin",
        marketplace: "target-marketplace",
        sourceAgent: "owned-second",
        generatedName: "owned-second-name",
        sourcePath: "/plugins/target/agents/owned-second.md",
        targetPath: "/pi/agents/owned-second-name.md",
        sourceHash: "owned-second-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: ["owned second warning"],
      },
      {
        plugin: "duplicate-plugin",
        marketplace: "duplicate-marketplace",
        sourceAgent: "duplicate-agent",
        generatedName: "shared-name",
        sourcePath: "/plugins/duplicate/agents/duplicate-agent.md",
        targetPath: "/pi/agents/shared-name.md",
        sourceHash: "duplicate-hash",
        originalModel: "haiku",
        droppedFields: ["memory"],
        droppedTools: ["WebFetch"],
        warnings: ["duplicate name warning"],
      },
    ];
    const expectedPartition = {
      previous: [
        {
          plugin: "target-plugin",
          marketplace: "target-marketplace",
          sourceAgent: "owned-first",
          generatedName: "shared-name",
          sourcePath: "/plugins/target/agents/owned-first.md",
          targetPath: "/pi/agents/shared-name.md",
          sourceHash: "owned-first-hash",
          originalModel: "sonnet",
          droppedFields: ["permissionMode"],
          droppedTools: ["NotebookEdit"],
          warnings: ["owned first warning"],
        },
        {
          plugin: "target-plugin",
          marketplace: "target-marketplace",
          sourceAgent: "owned-second",
          generatedName: "owned-second-name",
          sourcePath: "/plugins/target/agents/owned-second.md",
          targetPath: "/pi/agents/owned-second-name.md",
          sourceHash: "owned-second-hash",
          droppedFields: [],
          droppedTools: [],
          warnings: ["owned second warning"],
        },
      ],
      other: [
        {
          plugin: "other-plugin",
          marketplace: "target-marketplace",
          sourceAgent: "same-marketplace",
          generatedName: "other-plugin-name",
          sourcePath: "/plugins/other/agents/same-marketplace.md",
          targetPath: "/pi/agents/other-plugin-name.md",
          sourceHash: "same-marketplace-hash",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "target-plugin",
          marketplace: "other-marketplace",
          sourceAgent: "same-plugin",
          generatedName: "other-marketplace-name",
          sourcePath: "/plugins/target-other/agents/same-plugin.md",
          targetPath: "/pi/agents/other-marketplace-name.md",
          sourceHash: "same-plugin-hash",
          originalModel: "opus",
          droppedFields: ["hooks"],
          droppedTools: [],
          warnings: ["other marketplace warning"],
        },
        {
          plugin: "foreign-plugin",
          marketplace: "foreign-marketplace",
          sourceAgent: "foreign-agent",
          generatedName: "foreign-name",
          sourcePath: "/plugins/foreign/agents/foreign-agent.md",
          targetPath: "/pi/agents/foreign-name.md",
          sourceHash: "foreign-hash",
          droppedFields: [],
          droppedTools: ["Task"],
          warnings: [],
        },
        {
          plugin: "duplicate-plugin",
          marketplace: "duplicate-marketplace",
          sourceAgent: "duplicate-agent",
          generatedName: "shared-name",
          sourcePath: "/plugins/duplicate/agents/duplicate-agent.md",
          targetPath: "/pi/agents/shared-name.md",
          sourceHash: "duplicate-hash",
          originalModel: "haiku",
          droppedFields: ["memory"],
          droppedTools: ["WebFetch"],
          warnings: ["duplicate name warning"],
        },
      ],
    } satisfies {
      previous: readonly AgentsIndexEntry[];
      other: readonly AgentsIndexEntry[];
    };

    // act
    const partition = partitionByOwner(entries, "target-marketplace", "target-plugin");

    // assert
    assert.deepStrictEqual(partition, expectedPartition);
  });

  test("returns frozen empty partitions for an empty index", () => {
    // arrange
    const entries: AgentsIndexEntry[] = [];
    const expectedPartition = { previous: [], other: [] };

    // act
    const partition = partitionByOwner(entries, "target-marketplace", "target-plugin");

    // assert
    assert.deepStrictEqual(partition, expectedPartition);
    assert.strictEqual(Object.isFrozen(partition.previous), true);
    assert.strictEqual(Object.isFrozen(partition.other), true);
  });
});
