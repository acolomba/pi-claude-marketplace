import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertAgentNamesUnclaimed,
  partitionByOwner,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts";
import { AgentOwnershipConflictError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

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

describe("assertAgentNamesUnclaimed", () => {
  test("admits incoming names when the index has no foreign claims", () => {
    // arrange
    const owner = { marketplace: "catalog", plugin: "acme" };

    // act & assert
    assert.doesNotThrow(() => {
      assertAgentNamesUnclaimed(owner, [], ["bot"]);
    });
  });

  test("reports every foreign claim in incoming order without index paths or metadata", () => {
    // arrange
    const owner = { marketplace: "catalog", plugin: "acme" };
    const foreign: AgentsIndexEntry = {
      marketplace: "other",
      plugin: "acme",
      sourceAgent: "bot",
      generatedName: "bot",
      sourcePath: "/private/bot.md",
      targetPath: "/private/agents/bot.md",
      sourceHash: "hash",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    };

    // act & assert
    assert.throws(
      () => {
        assertAgentNamesUnclaimed(
          owner,
          [
            foreign,
            { ...foreign, generatedName: "helper", marketplace: "catalog", plugin: "rival" },
          ],
          ["helper", "free", "bot"],
        );
      },
      (error: unknown) => {
        assert.ok(error instanceof AgentOwnershipConflictError);
        assert.deepStrictEqual(error.stagingFor, owner);
        assert.deepStrictEqual(error.conflicts, [
          { generatedName: "helper", owner: { marketplace: "catalog", plugin: "rival" } },
          { generatedName: "bot", owner: { marketplace: "other", plugin: "acme" } },
        ]);
        assert.strictEqual(
          error.message,
          'Refusing to stage agents for catalog/acme: "helper" already owned by catalog/rival; "bot" already owned by other/acme.',
        );
        return true;
      },
    );
  });

  test("reports complete conflicts in incoming generated-name order", () => {
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

    // act & assert
    assert.throws(
      () => {
        assertAgentNamesUnclaimed(
          { marketplace: "catalog", plugin: "acme" },
          otherEntries,
          nextNames,
        );
      },
      (error: unknown) => {
        assert.ok(error instanceof AgentOwnershipConflictError);
        assert.deepStrictEqual(error.stagingFor, { marketplace: "catalog", plugin: "acme" });
        assert.deepStrictEqual(
          error.conflicts,
          expectedConflicts.map((conflict) => ({
            generatedName: conflict.generatedName,
            owner: { marketplace: conflict.owner.marketplace, plugin: conflict.owner.plugin },
          })),
        );
        return true;
      },
    );
  });

  test("admits incoming names that foreign index rows do not claim", () => {
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

    // act & assert
    assert.doesNotThrow(() => {
      assertAgentNamesUnclaimed(
        { marketplace: "catalog", plugin: "acme" },
        otherEntries,
        nextNames,
      );
    });
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

    // act & assert
    assert.throws(
      () => {
        assertAgentNamesUnclaimed(
          { marketplace: "catalog", plugin: "acme" },
          otherEntries,
          nextNames,
        );
      },
      (error: unknown) => {
        assert.ok(error instanceof AgentOwnershipConflictError);
        assert.deepStrictEqual(error.stagingFor, { marketplace: "catalog", plugin: "acme" });
        assert.deepStrictEqual(
          error.conflicts,
          expectedConflicts.map((conflict) => ({
            generatedName: conflict.generatedName,
            owner: { marketplace: conflict.owner.marketplace, plugin: conflict.owner.plugin },
          })),
        );
        return true;
      },
    );
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

    // act & assert
    assert.throws(
      () => {
        assertAgentNamesUnclaimed(
          { marketplace: "target-marketplace", plugin: "target-plugin" },
          partition.other,
          nextNames,
        );
      },
      (error: unknown) => {
        assert.ok(error instanceof AgentOwnershipConflictError);
        assert.deepStrictEqual(error.stagingFor, {
          marketplace: "target-marketplace",
          plugin: "target-plugin",
        });
        assert.deepStrictEqual(
          error.conflicts,
          expectedConflicts.map((conflict) => ({
            generatedName: conflict.generatedName,
            owner: { marketplace: conflict.owner.marketplace, plugin: conflict.owner.plugin },
          })),
        );
        return true;
      },
    );
  });
});
