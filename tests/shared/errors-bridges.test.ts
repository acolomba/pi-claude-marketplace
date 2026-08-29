import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgentForeignContentError,
  AgentOwnershipConflictError,
  BridgeStagingError,
  CommandNameError,
  McpServerCollisionError,
} from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { PathContainmentError } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { AgentOwnershipConflict } from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

void ({
  generatedName: "pi-claude-marketplace-acme-bot",
  owner: { marketplace: "official", plugin: "acme" },
} satisfies AgentOwnershipConflict);
// @ts-expect-error an ownership conflict requires its owner
void ({ generatedName: "pi-claude-marketplace-acme-bot" } satisfies AgentOwnershipConflict);

describe("AgentForeignContentError", () => {
  test("exposes the complete foreign-content refusal", () => {
    // arrange
    const targetPath = "/scope/agents/foreign.md";
    const reason = "missing marker";

    // act
    const error = new AgentForeignContentError(targetPath, reason);

    // assert
    assert.ok(error instanceof AgentForeignContentError);
    assert.ok(error instanceof PathContainmentError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        parent: error.parent,
        child: error.child,
        targetPath: error.targetPath,
        reason: error.reason,
        cause: error.cause,
      },
      {
        name: "AgentForeignContentError",
        message: "Refusing to overwrite agent file at /scope/agents/foreign.md: missing marker.",
        parent: "/scope/agents",
        child: "/scope/agents/foreign.md",
        targetPath: "/scope/agents/foreign.md",
        reason: "missing marker",
        cause: undefined,
      },
    );
  });

  test("keeps adjacent target paths and reasons distinct", () => {
    // arrange
    const firstTargetPath = "/scope/agents/a.md";
    const secondTargetPath = "/scope/agents/aa.md";

    // act
    const firstError = new AgentForeignContentError(firstTargetPath, "a");
    const secondError = new AgentForeignContentError(secondTargetPath, "aa");

    // assert
    assert.deepStrictEqual(
      [
        {
          message: firstError.message,
          parent: firstError.parent,
          child: firstError.child,
          targetPath: firstError.targetPath,
          reason: firstError.reason,
        },
        {
          message: secondError.message,
          parent: secondError.parent,
          child: secondError.child,
          targetPath: secondError.targetPath,
          reason: secondError.reason,
        },
      ],
      [
        {
          message: "Refusing to overwrite agent file at /scope/agents/a.md: a.",
          parent: "/scope/agents",
          child: "/scope/agents/a.md",
          targetPath: "/scope/agents/a.md",
          reason: "a",
        },
        {
          message: "Refusing to overwrite agent file at /scope/agents/aa.md: aa.",
          parent: "/scope/agents",
          child: "/scope/agents/aa.md",
          targetPath: "/scope/agents/aa.md",
          reason: "aa",
        },
      ],
    );
  });
});

describe("AgentOwnershipConflictError", () => {
  test("exposes an empty ownership conflict collection exactly", () => {
    // arrange
    const conflicts = [] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError(
      { marketplace: "official", plugin: "acme" },
      conflicts,
    );

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        conflicts: error.conflicts,
        conflictsFrozen: Object.isFrozen(error.conflicts),
        stagingFor: error.stagingFor,
        stagingForFrozen: Object.isFrozen(error.stagingFor),
      },
      {
        name: "AgentOwnershipConflictError",
        message: "Refusing to stage agents for official/acme: .",
        conflicts: [],
        conflictsFrozen: true,
        stagingFor: { marketplace: "official", plugin: "acme" },
        stagingForFrozen: true,
      },
    );
  });

  test("exposes one ownership conflict as a complete refusal", () => {
    // arrange
    const stagingFor = { marketplace: "official", plugin: "acme" };
    const conflicts = [
      {
        generatedName: "pi-claude-marketplace-acme-bot",
        owner: { marketplace: "official", plugin: "old-acme" },
      },
    ] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError(stagingFor, conflicts);

    // assert
    assert.ok(error instanceof AgentOwnershipConflictError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        conflicts: error.conflicts,
        stagingFor: error.stagingFor,
        cause: error.cause,
      },
      {
        name: "AgentOwnershipConflictError",
        message:
          'Refusing to stage agents for official/acme: "pi-claude-marketplace-acme-bot" already owned by official/old-acme.',
        conflicts: [
          {
            generatedName: "pi-claude-marketplace-acme-bot",
            owner: { marketplace: "official", plugin: "old-acme" },
          },
        ],
        stagingFor: { marketplace: "official", plugin: "acme" },
        cause: undefined,
      },
    );
  });

  test("keeps several ownership conflicts in caller order", () => {
    // arrange
    const conflicts = [
      { generatedName: "n1", owner: { marketplace: "mp", plugin: "other1" } },
      { generatedName: "n2", owner: { marketplace: "mp", plugin: "other2" } },
      { generatedName: "n3", owner: { marketplace: "mp", plugin: "other3" } },
    ] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError({ marketplace: "mp", plugin: "p" }, conflicts);

    // assert
    assert.deepStrictEqual(
      {
        message: error.message,
        conflicts: error.conflicts,
      },
      {
        message:
          'Refusing to stage agents for mp/p: "n1" already owned by mp/other1; "n2" already owned by mp/other2; "n3" already owned by mp/other3.',
        conflicts: [
          { generatedName: "n1", owner: { marketplace: "mp", plugin: "other1" } },
          { generatedName: "n2", owner: { marketplace: "mp", plugin: "other2" } },
          { generatedName: "n3", owner: { marketplace: "mp", plugin: "other3" } },
        ],
      },
    );
  });

  test("keeps equal generated names separate and ordered", () => {
    // arrange
    const conflicts = [
      { generatedName: "same", owner: { marketplace: "mp", plugin: "first" } },
      { generatedName: "same", owner: { marketplace: "mp", plugin: "second" } },
    ] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError(
      { marketplace: "mp", plugin: "candidate" },
      conflicts,
    );

    // assert
    assert.deepStrictEqual(
      {
        message: error.message,
        conflicts: error.conflicts,
      },
      {
        message:
          'Refusing to stage agents for mp/candidate: "same" already owned by mp/first; "same" already owned by mp/second.',
        conflicts: [
          { generatedName: "same", owner: { marketplace: "mp", plugin: "first" } },
          { generatedName: "same", owner: { marketplace: "mp", plugin: "second" } },
        ],
      },
    );
  });

  test("copies mutable top-level constructor inputs", () => {
    // arrange
    const stagingFor = { marketplace: "mp", plugin: "candidate" };
    const conflicts = [
      { generatedName: "same", owner: { marketplace: "mp", plugin: "owner" } },
    ] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError(stagingFor, conflicts);
    stagingFor.marketplace = "changed";
    stagingFor.plugin = "changed";
    conflicts.push({
      generatedName: "later",
      owner: { marketplace: "changed", plugin: "changed" },
    });

    // assert
    assert.deepStrictEqual(
      {
        message: error.message,
        conflicts: error.conflicts,
        stagingFor: error.stagingFor,
      },
      {
        message: 'Refusing to stage agents for mp/candidate: "same" already owned by mp/owner.',
        conflicts: [{ generatedName: "same", owner: { marketplace: "mp", plugin: "owner" } }],
        stagingFor: { marketplace: "mp", plugin: "candidate" },
      },
    );
  });

  test("freezes the exposed conflict collection and staging owner", () => {
    // arrange
    const conflicts = [
      { generatedName: "agent", owner: { marketplace: "mp", plugin: "owner" } },
    ] satisfies AgentOwnershipConflict[];

    // act
    const error = new AgentOwnershipConflictError(
      { marketplace: "mp", plugin: "candidate" },
      conflicts,
    );

    // assert
    assert.deepStrictEqual(
      {
        conflictsFrozen: Object.isFrozen(error.conflicts),
        stagingForFrozen: Object.isFrozen(error.stagingFor),
        conflicts: error.conflicts,
        stagingFor: error.stagingFor,
      },
      {
        conflictsFrozen: true,
        stagingForFrozen: true,
        conflicts: [{ generatedName: "agent", owner: { marketplace: "mp", plugin: "owner" } }],
        stagingFor: { marketplace: "mp", plugin: "candidate" },
      },
    );
  });
});

describe("McpServerCollisionError", () => {
  test("exposes the complete MCP collision refusal", () => {
    // arrange
    const serverName = "acme-server";
    const owningPath = "/scope/mcp.json";

    // act
    const error = new McpServerCollisionError(serverName, owningPath);

    // assert
    assert.ok(error instanceof McpServerCollisionError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        serverName: error.serverName,
        owningPath: error.owningPath,
        cause: error.cause,
      },
      {
        name: "McpServerCollisionError",
        message: 'Refusing to stage MCP server "acme-server": already exists in /scope/mcp.json.',
        serverName: "acme-server",
        owningPath: "/scope/mcp.json",
        cause: undefined,
      },
    );
  });

  test("keeps adjacent server names and owning paths distinct", () => {
    // arrange
    const firstServerName = "server";
    const secondServerName = "server-1";

    // act
    const firstError = new McpServerCollisionError(firstServerName, "/scope/mcp.json");
    const secondError = new McpServerCollisionError(secondServerName, "/scope/mcp-1.json");

    // assert
    assert.deepStrictEqual(
      [
        {
          message: firstError.message,
          serverName: firstError.serverName,
          owningPath: firstError.owningPath,
        },
        {
          message: secondError.message,
          serverName: secondError.serverName,
          owningPath: secondError.owningPath,
        },
      ],
      [
        {
          message: 'Refusing to stage MCP server "server": already exists in /scope/mcp.json.',
          serverName: "server",
          owningPath: "/scope/mcp.json",
        },
        {
          message: 'Refusing to stage MCP server "server-1": already exists in /scope/mcp-1.json.',
          serverName: "server-1",
          owningPath: "/scope/mcp-1.json",
        },
      ],
    );
  });
});

describe("BridgeStagingError", () => {
  test("preserves its complete message and cause", () => {
    // arrange
    const cause = new Error("ENOSPC: no space left");

    // act
    const error = new BridgeStagingError("staging tmp failed", { cause });

    // assert
    assert.ok(error instanceof BridgeStagingError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        cause: error.cause,
      },
      {
        name: "BridgeStagingError",
        message: "staging tmp failed",
        cause,
      },
    );
  });

  test("exposes no cause when options are absent", () => {
    // arrange
    const message = "plain message";

    // act
    const error = new BridgeStagingError(message);

    // assert
    assert.ok(error instanceof BridgeStagingError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        cause: error.cause,
      },
      {
        name: "BridgeStagingError",
        message: "plain message",
        cause: undefined,
      },
    );
  });
});

describe("CommandNameError", () => {
  test("exposes the complete invalid command-source refusal", () => {
    // arrange
    const sourceName = "tools/bad name";
    const commandsDir = "/plugins/acme/commands";
    const cause = new Error("command name contains an invalid segment");

    // act
    const error = new CommandNameError(sourceName, commandsDir, { cause });

    // assert
    assert.ok(error instanceof CommandNameError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        sourceName: error.sourceName,
        commandsDir: error.commandsDir,
        cause: error.cause,
      },
      {
        name: "CommandNameError",
        message: 'invalid command source "tools/bad name" in "/plugins/acme/commands"',
        sourceName: "tools/bad name",
        commandsDir: "/plugins/acme/commands",
        cause,
      },
    );
  });

  test("keeps adjacent source names and directories distinct", () => {
    // arrange
    const firstSourceName = "a";
    const secondSourceName = "aa";

    // act
    const firstError = new CommandNameError(firstSourceName, "/commands/a");
    const secondError = new CommandNameError(secondSourceName, "/commands/aa");

    // assert
    assert.deepStrictEqual(
      [
        {
          message: firstError.message,
          sourceName: firstError.sourceName,
          commandsDir: firstError.commandsDir,
          cause: firstError.cause,
        },
        {
          message: secondError.message,
          sourceName: secondError.sourceName,
          commandsDir: secondError.commandsDir,
          cause: secondError.cause,
        },
      ],
      [
        {
          message: 'invalid command source "a" in "/commands/a"',
          sourceName: "a",
          commandsDir: "/commands/a",
          cause: undefined,
        },
        {
          message: 'invalid command source "aa" in "/commands/aa"',
          sourceName: "aa",
          commandsDir: "/commands/aa",
          cause: undefined,
        },
      ],
    );
  });
});
