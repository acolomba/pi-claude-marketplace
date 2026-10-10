import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgentOwnershipConflictError,
  BridgeStagingError,
  CommandNameError,
  McpConfigFileError,
  McpServerCollisionError,
  McpServerKeyCollisionError,
  McpUnstagePartialError,
  WorkflowTargetOccupiedError,
} from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { AgentOwnershipConflict } from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

void ({
  generatedName: "pi-claude-marketplace-acme-bot",
  owner: { marketplace: "official", plugin: "acme" },
} satisfies AgentOwnershipConflict);
// @ts-expect-error an ownership conflict requires its owner
void ({ generatedName: "pi-claude-marketplace-acme-bot" } satisfies AgentOwnershipConflict);

// Both staging errors take the ambient `ErrorOptions` bag, whose only member is
// `cause`. A bag carrying anything else is a compile error at the construction
// site, so a caller cannot smuggle a field the base constructor silently drops.
void new BridgeStagingError("staging tmp failed", { cause: new Error("ENOSPC") });
// @ts-expect-error the staging options bag admits `cause` and nothing else
void new BridgeStagingError("staging tmp failed", { reason: "ENOSPC" });
void new CommandNameError("a", "/commands/a", { cause: new Error("bad segment") });
// @ts-expect-error the command-name options bag admits `cause` and nothing else
void new CommandNameError("a", "/commands/a", { cause: new Error("bad segment"), reason: "x" });

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
  test("AFILE-05: exposes the owning and winning sources of an MCP collision refusal", () => {
    // arrange
    const serverName = "acme-server";
    const owningPath = "/home/.agents/mcp.json";
    const winningPath = "/home/.pi/agent/mcp-adapter.json";

    // act
    const error = new McpServerCollisionError(serverName, owningPath, winningPath);

    // assert
    assert.ok(error instanceof McpServerCollisionError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        serverName: error.serverName,
        owningPath: error.owningPath,
        winningPath: error.winningPath,
        cause: error.cause,
      },
      {
        name: "McpServerCollisionError",
        message:
          'Refusing to stage MCP server "acme-server": /home/.agents/mcp.json already defines it, and pi-mcp-adapter would load the definition in /home/.pi/agent/mcp-adapter.json.',
        serverName: "acme-server",
        owningPath: "/home/.agents/mcp.json",
        winningPath: "/home/.pi/agent/mcp-adapter.json",
        cause: undefined,
      },
    );
  });

  test("keeps adjacent server names, owning paths and winning paths distinct", () => {
    // arrange
    const firstServerName = "server";
    const secondServerName = "server-1";

    // act
    const firstError = new McpServerCollisionError(
      firstServerName,
      "/scope/mcp.json",
      "/scope/mcp-adapter.json",
    );
    const secondError = new McpServerCollisionError(
      secondServerName,
      "/scope/mcp-1.json",
      "/scope/mcp-1.json",
    );

    // assert
    assert.deepStrictEqual(
      [
        {
          message: firstError.message,
          serverName: firstError.serverName,
          owningPath: firstError.owningPath,
          winningPath: firstError.winningPath,
        },
        {
          message: secondError.message,
          serverName: secondError.serverName,
          owningPath: secondError.owningPath,
          winningPath: secondError.winningPath,
        },
      ],
      [
        {
          message:
            'Refusing to stage MCP server "server": /scope/mcp.json already defines it, and pi-mcp-adapter would load the definition in /scope/mcp-adapter.json.',
          serverName: "server",
          owningPath: "/scope/mcp.json",
          winningPath: "/scope/mcp-adapter.json",
        },
        {
          message:
            'Refusing to stage MCP server "server-1": /scope/mcp-1.json already defines it, and pi-mcp-adapter would load the definition in /scope/mcp-1.json.',
          serverName: "server-1",
          owningPath: "/scope/mcp-1.json",
          winningPath: "/scope/mcp-1.json",
        },
      ],
    );
  });

  test("ANAME-03: names the other source's key when it folds onto the staged key", () => {
    // arrange
    const otherKey = "plugin_my-tools_db_";

    // act
    const error = new McpServerCollisionError(
      "plugin_my_tools_db_",
      "/scope/mcp-adapter.json",
      "/scope/mcp-adapter.json",
      otherKey,
    );

    // assert
    assert.ok(error instanceof McpServerCollisionError);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        serverName: error.serverName,
        owningPath: error.owningPath,
        winningPath: error.winningPath,
        definedAs: error.definedAs,
      },
      {
        name: "McpServerCollisionError",
        message:
          'Refusing to stage MCP server "plugin_my_tools_db_": /scope/mcp-adapter.json already defines "plugin_my-tools_db_", which Pi treats as the same tool namespace because it does not tell "-" from "_".',
        serverName: "plugin_my_tools_db_",
        owningPath: "/scope/mcp-adapter.json",
        winningPath: "/scope/mcp-adapter.json",
        definedAs: "plugin_my-tools_db_",
      },
    );
  });

  test("ANAME-03: an other key equal to the staged key keeps the equal-key message and no definedAs", () => {
    // arrange
    const otherKey = "plugin_acme_db_";

    // act
    const error = new McpServerCollisionError(
      "plugin_acme_db_",
      "/scope/mcp.json",
      "/scope/mcp-adapter.json",
      otherKey,
    );

    // assert
    assert.deepStrictEqual(
      { message: error.message, definedAs: error.definedAs },
      {
        message:
          'Refusing to stage MCP server "plugin_acme_db_": /scope/mcp.json already defines it, and pi-mcp-adapter would load the definition in /scope/mcp-adapter.json.',
        definedAs: undefined,
      },
    );
  });
});

describe("McpServerKeyCollisionError", () => {
  test("ANAME-03: names the plugin, both servers and the one key they share", () => {
    // arrange
    const servers = ["a.b", "a_b"] as const;
    const keys = ["plugin_acme_a_b_", "plugin_acme_a_b_"] as const;

    // act
    const error = new McpServerKeyCollisionError("acme", servers, keys);

    // assert
    assert.ok(error instanceof McpServerKeyCollisionError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        pluginName: error.pluginName,
        servers: error.servers,
        keys: error.keys,
        cause: error.cause,
      },
      {
        name: "McpServerKeyCollisionError",
        message:
          'Refusing to stage MCP servers "a.b" and "a_b" of plugin "acme": both map to the server key "plugin_acme_a_b_".',
        pluginName: "acme",
        servers: ["a.b", "a_b"],
        keys: ["plugin_acme_a_b_", "plugin_acme_a_b_"],
        cause: undefined,
      },
    );
  });

  test("ANAME-03: names both keys when they differ only by - and _", () => {
    // arrange
    const servers = ["a-b", "a_b"] as const;
    const keys = ["plugin_acme_a-b_", "plugin_acme_a_b_"] as const;

    // act
    const error = new McpServerKeyCollisionError("acme", servers, keys);

    // assert
    assert.deepStrictEqual(
      {
        message: error.message,
        pluginName: error.pluginName,
        servers: error.servers,
        keys: error.keys,
      },
      {
        message:
          'Refusing to stage MCP servers "a-b" and "a_b" of plugin "acme": their server keys "plugin_acme_a-b_" and "plugin_acme_a_b_" differ only by "-" and "_", which Pi treats as one tool namespace.',
        pluginName: "acme",
        servers: ["a-b", "a_b"],
        keys: ["plugin_acme_a-b_", "plugin_acme_a_b_"],
      },
    );
  });
});

describe("McpConfigFileError", () => {
  for (const { defect, message } of [
    {
      defect: "invalid-jsonc",
      message: "MCP config /scope/mcp-adapter.json is not valid JSONC; it was left unchanged.",
    },
    {
      defect: "top-level-not-object",
      message:
        "MCP config /scope/mcp-adapter.json does not hold a JSON object; it was left unchanged.",
    },
    {
      defect: "mcpServers-not-object",
      message:
        'MCP config /scope/mcp-adapter.json has an "mcpServers" value that is not an object; it was left unchanged.',
    },
    {
      defect: "mcp-servers-not-object",
      message:
        'MCP config /scope/mcp-adapter.json has an "mcp-servers" value that is not an object; it was left unchanged.',
    },
  ] as const) {
    test(`AFILE-02: names the file and the ${defect} defect without a cause`, () => {
      // arrange
      const filePath = "/scope/mcp-adapter.json";

      // act
      const error = new McpConfigFileError(filePath, defect);

      // assert
      assert.ok(error instanceof McpConfigFileError);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          filePath: error.filePath,
          defect: error.defect,
          cause: error.cause,
        },
        { name: "McpConfigFileError", message, filePath, defect, cause: undefined },
      );
    });
  }
});

describe("McpUnstagePartialError", () => {
  test("AFILE-04: carries frozen copies of the rewritten files' names, notices, and bytes and the write failure", () => {
    // arrange
    const cause = new Error("EACCES: permission denied");
    const removedNames = ["first"];
    const notices = [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
    ] as const;
    const written = [{ path: "/scope/mcp-adapter.json", bytes: Buffer.from("{}\n") }];

    // act
    const error = new McpUnstagePartialError(removedNames, notices, written, { cause });
    removedNames.push("later");
    written.push({ path: "/scope/mcp.json", bytes: Buffer.from("[]\n") });

    // assert
    assert.ok(error instanceof McpUnstagePartialError);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        removedNames: error.removedNames,
        notices: error.notices,
        written: error.written,
        cause: error.cause,
        frozen:
          Object.isFrozen(error.removedNames) &&
          Object.isFrozen(error.notices) &&
          Object.isFrozen(error.written),
      },
      {
        name: "McpUnstagePartialError",
        message: "MCP unstage stopped after rewriting part of its config files.",
        removedNames: ["first"],
        notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
        written: [{ path: "/scope/mcp-adapter.json", bytes: Buffer.from("{}\n") }],
        cause,
        frozen: true,
      },
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

describe("WorkflowTargetOccupiedError", () => {
  test("exposes the complete occupied-target refusal", () => {
    // arrange
    const targetPath = "/home/dev/.pi/workflows/saved/acme:deploy.json";

    // act
    const error = new WorkflowTargetOccupiedError(targetPath);

    // assert
    // Two rungs only: this refusal is a plain Error, not a containment error.
    assert.ok(error instanceof WorkflowTargetOccupiedError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        targetPath: error.targetPath,
        cause: error.cause,
      },
      {
        name: "WorkflowTargetOccupiedError",
        message:
          "Cannot replace workflow target with non-previous content at /home/dev/.pi/workflows/saved/acme:deploy.json",
        targetPath: "/home/dev/.pi/workflows/saved/acme:deploy.json",
        cause: undefined,
      },
    );
  });

  test("keeps adjacent target paths distinct", () => {
    // arrange
    const firstTargetPath = "/home/dev/.pi/workflows/saved/a.json";
    const secondTargetPath = "/home/dev/.pi/workflows/saved/aa.json";

    // act
    const firstError = new WorkflowTargetOccupiedError(firstTargetPath);
    const secondError = new WorkflowTargetOccupiedError(secondTargetPath);

    // assert
    assert.deepStrictEqual(
      [
        { message: firstError.message, targetPath: firstError.targetPath },
        { message: secondError.message, targetPath: secondError.targetPath },
      ],
      [
        {
          message:
            "Cannot replace workflow target with non-previous content at /home/dev/.pi/workflows/saved/a.json",
          targetPath: "/home/dev/.pi/workflows/saved/a.json",
        },
        {
          message:
            "Cannot replace workflow target with non-previous content at /home/dev/.pi/workflows/saved/aa.json",
          targetPath: "/home/dev/.pi/workflows/saved/aa.json",
        },
      ],
    );
  });

  test("exposes the target path as a field rather than as message text to parse", () => {
    // arrange
    // The path repeats the message's own " at " separator, so a consumer that
    // recovered the path by splitting the message would keep the wrong half.
    const targetPath = "/home/dev/.pi/workflows/saved/acme:deploy at once.json";

    // act
    const error = new WorkflowTargetOccupiedError(targetPath);

    // assert
    assert.strictEqual(error.targetPath, targetPath);
  });
});
