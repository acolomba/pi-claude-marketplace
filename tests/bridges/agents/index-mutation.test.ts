import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  findOwnershipConflicts,
  partitionByOwner,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts";

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

describe("findOwnershipConflicts", () => {
  test("returns complete conflicts in incoming generated-name order", () => {
    // arrange
    const otherEntries: AgentsIndexEntry[] = [
      {
        plugin: "alpha-plugin",
        marketplace: "alpha-marketplace",
        sourceAgent: "alpha-agent",
        generatedName: "alpha-name",
        sourcePath: "/plugins/alpha/agents/alpha-agent.md",
        targetPath: "/pi/agents/alpha-name.md",
        sourceHash: "alpha-hash",
        originalModel: "sonnet",
        droppedFields: ["permissionMode"],
        droppedTools: [],
        warnings: ["alpha warning"],
      },
      {
        plugin: "beta-plugin",
        marketplace: "beta-marketplace",
        sourceAgent: "beta-agent",
        generatedName: "beta-name",
        sourcePath: "/plugins/beta/agents/beta-agent.md",
        targetPath: "/pi/agents/beta-name.md",
        sourceHash: "beta-hash",
        droppedFields: [],
        droppedTools: ["Task"],
        warnings: [],
      },
      {
        plugin: "gamma-plugin",
        marketplace: "gamma-marketplace",
        sourceAgent: "gamma-agent",
        generatedName: "gamma-name",
        sourcePath: "/plugins/gamma/agents/gamma-agent.md",
        targetPath: "/pi/agents/gamma-name.md",
        sourceHash: "gamma-hash",
        originalModel: "opus",
        droppedFields: ["hooks"],
        droppedTools: ["NotebookEdit"],
        warnings: ["gamma warning"],
      },
    ];
    const nextNames = ["gamma-name", "unclaimed-name", "alpha-name", "beta-name"];
    const expectedConflicts = [
      {
        generatedName: "gamma-name",
        owner: {
          plugin: "gamma-plugin",
          marketplace: "gamma-marketplace",
          sourceAgent: "gamma-agent",
          generatedName: "gamma-name",
          sourcePath: "/plugins/gamma/agents/gamma-agent.md",
          targetPath: "/pi/agents/gamma-name.md",
          sourceHash: "gamma-hash",
          originalModel: "opus",
          droppedFields: ["hooks"],
          droppedTools: ["NotebookEdit"],
          warnings: ["gamma warning"],
        },
      },
      {
        generatedName: "alpha-name",
        owner: {
          plugin: "alpha-plugin",
          marketplace: "alpha-marketplace",
          sourceAgent: "alpha-agent",
          generatedName: "alpha-name",
          sourcePath: "/plugins/alpha/agents/alpha-agent.md",
          targetPath: "/pi/agents/alpha-name.md",
          sourceHash: "alpha-hash",
          originalModel: "sonnet",
          droppedFields: ["permissionMode"],
          droppedTools: [],
          warnings: ["alpha warning"],
        },
      },
      {
        generatedName: "beta-name",
        owner: {
          plugin: "beta-plugin",
          marketplace: "beta-marketplace",
          sourceAgent: "beta-agent",
          generatedName: "beta-name",
          sourcePath: "/plugins/beta/agents/beta-agent.md",
          targetPath: "/pi/agents/beta-name.md",
          sourceHash: "beta-hash",
          droppedFields: [],
          droppedTools: ["Task"],
          warnings: [],
        },
      },
    ];

    // act
    const conflicts = findOwnershipConflicts(otherEntries, nextNames);

    // assert
    assert.deepStrictEqual(conflicts, expectedConflicts);
  });

  test("returns no conflicts when incoming names are unclaimed", () => {
    // arrange
    const otherEntries: AgentsIndexEntry[] = [
      {
        plugin: "existing-plugin",
        marketplace: "existing-marketplace",
        sourceAgent: "existing-agent",
        generatedName: "existing-name",
        sourcePath: "/plugins/existing/agents/existing-agent.md",
        targetPath: "/pi/agents/existing-name.md",
        sourceHash: "existing-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ];
    const nextNames = ["new-first-name", "new-second-name"];
    const expectedConflicts: { generatedName: string; owner: AgentsIndexEntry }[] = [];

    // act
    const conflicts = findOwnershipConflicts(otherEntries, nextNames);

    // assert
    assert.deepStrictEqual(conflicts, expectedConflicts);
  });

  test("uses the last repeated owner row for every repeated incoming name", () => {
    // arrange
    const otherEntries: AgentsIndexEntry[] = [
      {
        plugin: "first-plugin",
        marketplace: "first-marketplace",
        sourceAgent: "first-agent",
        generatedName: "duplicate-name",
        sourcePath: "/plugins/first/agents/first-agent.md",
        targetPath: "/pi/agents/duplicate-name.md",
        sourceHash: "first-hash",
        droppedFields: ["memory"],
        droppedTools: [],
        warnings: ["first warning"],
      },
      {
        plugin: "last-plugin",
        marketplace: "last-marketplace",
        sourceAgent: "last-agent",
        generatedName: "duplicate-name",
        sourcePath: "/plugins/last/agents/last-agent.md",
        targetPath: "/pi/agents/duplicate-name.md",
        sourceHash: "last-hash",
        originalModel: "haiku",
        droppedFields: [],
        droppedTools: ["WebFetch"],
        warnings: ["last warning"],
      },
    ];
    const nextNames = ["duplicate-name", "duplicate-name"];
    const expectedConflicts = [
      {
        generatedName: "duplicate-name",
        owner: {
          plugin: "last-plugin",
          marketplace: "last-marketplace",
          sourceAgent: "last-agent",
          generatedName: "duplicate-name",
          sourcePath: "/plugins/last/agents/last-agent.md",
          targetPath: "/pi/agents/duplicate-name.md",
          sourceHash: "last-hash",
          originalModel: "haiku",
          droppedFields: [],
          droppedTools: ["WebFetch"],
          warnings: ["last warning"],
        },
      },
      {
        generatedName: "duplicate-name",
        owner: {
          plugin: "last-plugin",
          marketplace: "last-marketplace",
          sourceAgent: "last-agent",
          generatedName: "duplicate-name",
          sourcePath: "/plugins/last/agents/last-agent.md",
          targetPath: "/pi/agents/duplicate-name.md",
          sourceHash: "last-hash",
          originalModel: "haiku",
          droppedFields: [],
          droppedTools: ["WebFetch"],
          warnings: ["last warning"],
        },
      },
    ];

    // act
    const conflicts = findOwnershipConflicts(otherEntries, nextNames);

    // assert
    assert.deepStrictEqual(conflicts, expectedConflicts);
  });

  test("detects conflicts only across the non-owner merge boundary", () => {
    // arrange
    const entries: AgentsIndexEntry[] = [
      {
        plugin: "target-plugin",
        marketplace: "target-marketplace",
        sourceAgent: "target-agent",
        generatedName: "self-name",
        sourcePath: "/plugins/target/agents/target-agent.md",
        targetPath: "/pi/agents/self-name.md",
        sourceHash: "target-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      {
        plugin: "rival-plugin",
        marketplace: "rival-marketplace",
        sourceAgent: "rival-agent",
        generatedName: "rival-name",
        sourcePath: "/plugins/rival/agents/rival-agent.md",
        targetPath: "/pi/agents/rival-name.md",
        sourceHash: "rival-hash",
        originalModel: "opus",
        droppedFields: ["permissionMode"],
        droppedTools: ["Task"],
        warnings: ["rival warning"],
      },
    ];
    const nextNames = ["self-name", "rival-name"];
    const expectedConflicts = [
      {
        generatedName: "rival-name",
        owner: {
          plugin: "rival-plugin",
          marketplace: "rival-marketplace",
          sourceAgent: "rival-agent",
          generatedName: "rival-name",
          sourcePath: "/plugins/rival/agents/rival-agent.md",
          targetPath: "/pi/agents/rival-name.md",
          sourceHash: "rival-hash",
          originalModel: "opus",
          droppedFields: ["permissionMode"],
          droppedTools: ["Task"],
          warnings: ["rival warning"],
        },
      },
    ];
    const partition = partitionByOwner(entries, "target-marketplace", "target-plugin");

    // act
    const conflicts = findOwnershipConflicts(partition.other, nextNames);

    // assert
    assert.deepStrictEqual(conflicts, expectedConflicts);
  });
});
