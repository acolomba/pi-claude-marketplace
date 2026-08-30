import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedMcp,
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { McpServerCollisionError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

async function createProjectScope(
  t: TestContext,
  prefix: string,
): Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
  return { cwd, locations: locationsFor("project", cwd) };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

describe("prepareStageMcpServers", () => {
  test("returns a complete frozen no-op for an empty resolved server set", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-empty-");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "empty-plugin",
      pluginRoot: path.join(cwd, "plugins", "empty-plugin"),
      pluginData: path.join(cwd, "data", "empty-plugin"),
      servers: {},
    });

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: { stagedNames: [], recorded: [], warnings: [] },
    });
    assert.strictEqual(Object.isFrozen(prepared.result.stagedNames), true);
    assert.strictEqual(Object.isFrozen(prepared.result.recorded), true);
    assert.strictEqual(Object.isFrozen(prepared.result.warnings), true);
    assert.strictEqual(await pathExists(locations.mcpJsonPath), false);
  });

  test("replaces owned servers and preserves complete foreign content", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-merge-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      '{"foreignTopLevel":{"enabled":true},"mcpServers":{"foreign":{"command":"foreign-command","env":{"TOKEN":"foreign-token"},"_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}},"previous":{"command":"old-command","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );
    const expectedDoc = {
      foreignTopLevel: { enabled: true },
      mcpServers: {
        foreign: {
          command: "foreign-command",
          env: { TOKEN: "foreign-token" },
          _piClaudeMarketplace: { plugin: "other", marketplace: "catalog" },
        },
        current: {
          command: path.join(pluginRoot, "bin", "server"),
          args: ["--data", pluginData],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
            CLAUDE_PROJECT_DIR: cwd,
            CUSTOM: path.join(pluginData, "custom"),
          },
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    };

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginData,
      sourcePath: path.join(pluginRoot, ".mcp.json"),
      servers: {
        current: {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
          args: ["--data", "${CLAUDE_PLUGIN_DATA}"],
          env: { CUSTOM: "${CLAUDE_PLUGIN_DATA}/custom" },
        },
      },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared._nextDoc, expectedDoc);
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["current"],
      recorded: [
        {
          generatedName: "current",
          sourcePath: path.join(pluginRoot, ".mcp.json"),
          targetPath: locations.mcpJsonPath,
        },
      ],
      warnings: [],
    });
  });

  test("stages an empty set when previous owned servers must be removed", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-drop-");
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      '{"mcpServers":{"owned":{"command":"old","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: {},
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared._nextDoc, { mcpServers: {} });
    assert.deepStrictEqual(prepared.result, { stagedNames: [], recorded: [], warnings: [] });
  });

  test("reports malformed stored JSON before replacing it", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-malformed-");
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, "{");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { url: "https://mcp.example.test" } },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared.result.warnings, [
      `existing mcp.json at ${locations.mcpJsonPath} is malformed; it will be replaced (non-plugin entries in it are lost)`,
    ]);
    assert.deepStrictEqual(prepared._nextDoc, {
      mcpServers: {
        server: {
          url: "https://mcp.example.test",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("treats an array server map as empty while preserving top-level fields", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-array-");
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(locations.mcpJsonPath, '{"foreignTopLevel":"keep","mcpServers":[]}');

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { url: "https://mcp.example.test" } },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared._nextDoc, {
      foreignTopLevel: "keep",
      mcpServers: {
        server: {
          url: "https://mcp.example.test",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("normalizes malformed server values with complete ordered warnings", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-normalize-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginData,
      servers: {
        malformedEnv: { command: "node", env: ["invalid"] },
        scalar: "invalid",
      },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared.result.warnings, [
      'mcp server "malformedEnv": declared env is not an object; it was ignored (injected defaults only)',
      'mcp server "scalar": entry is not an object; staged as an empty entry',
    ]);
    assert.deepStrictEqual(prepared._nextDoc, {
      mcpServers: {
        malformedEnv: {
          command: "node",
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
            CLAUDE_PROJECT_DIR: cwd,
          },
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
        scalar: {
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("rejects a foreign server in the scoped document", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-scope-collision-");
    await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
    await writeFile(
      locations.mcpJsonPath,
      '{"mcpServers":{"duplicate":{"command":"foreign","_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}}}}',
    );

    // act
    const collision = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { duplicate: { command: "owned" } },
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(
      {
        name: collision.name,
        message: collision.message,
        serverName: collision.serverName,
        owningPath: collision.owningPath,
      },
      {
        name: "McpServerCollisionError",
        message: `Refusing to stage MCP server "duplicate": already exists in ${locations.mcpJsonPath}.`,
        serverName: "duplicate",
        owningPath: locations.mcpJsonPath,
      },
    );
  });

  test("rejects a server declared in an earlier collision slot", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-slot-collision-");
    const earlierSlot = path.join(cwd, ".mcp.json");
    await writeFile(earlierSlot, '{"mcpServers":{"duplicate":{"command":"foreign"}}}');

    // act
    const collision = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { duplicate: { command: "owned" } },
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(
      {
        name: collision.name,
        message: collision.message,
        serverName: collision.serverName,
        owningPath: collision.owningPath,
      },
      {
        name: "McpServerCollisionError",
        message: `Refusing to stage MCP server "duplicate": already exists in ${earlierSlot}.`,
        serverName: "duplicate",
        owningPath: earlierSlot,
      },
    );
  });

  test("omits project substitution and injection in a user scope", async (t) => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "mcp-stage-user-cwd-"));
    const agentDirectory = await mkdtemp(path.join(tmpdir(), "mcp-stage-user-agent-"));
    t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
    t.after(() => rm(agentDirectory, { recursive: true, force: true, maxRetries: 3 }));
    const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (previousAgentDirectory === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
      }
    });
    process.env.PI_CODING_AGENT_DIR = agentDirectory;
    const locations = locationsFor("user", cwd);
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginData,
      servers: { server: { command: "${CLAUDE_PROJECT_DIR}/server" } },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }
    assert.deepStrictEqual(prepared._nextDoc, {
      mcpServers: {
        server: {
          command: "${CLAUDE_PROJECT_DIR}/server",
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
          },
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });
});

describe("commitPreparedMcp", () => {
  test("writes exact scoped bytes and returns complete source provenance", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-commit-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    const sourcePath = path.join(pluginRoot, ".mcp.json");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginData,
      sourcePath,
      servers: {
        local: {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
          args: ["--store", "${CLAUDE_PLUGIN_DATA}"],
        },
      },
    });
    const expectedBytes = `{
  "mcpServers": {
    "local": {
      "command": ${JSON.stringify(path.join(pluginRoot, "bin", "server"))},
      "args": [
        "--store",
        ${JSON.stringify(pluginData)}
      ],
      "env": {
        "CLAUDE_PLUGIN_ROOT": ${JSON.stringify(pluginRoot)},
        "CLAUDE_PLUGIN_DATA": ${JSON.stringify(pluginData)},
        "CLAUDE_PROJECT_DIR": ${JSON.stringify(cwd)}
      },
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

    // act
    const commit = await commitPreparedMcp(prepared);
    const storedBytes = await readFile(locations.mcpJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(commit, {
      stagedNames: ["local"],
      recorded: [{ generatedName: "local", sourcePath, targetPath: locations.mcpJsonPath }],
      warnings: [],
    });
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("returns a no-op unchanged without materializing a file", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-noop-commit-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "empty-plugin",
      pluginRoot: path.join(cwd, "plugins", "empty-plugin"),
      pluginData: path.join(cwd, "data", "empty-plugin"),
      servers: {},
    });

    // act
    const commit = await commitPreparedMcp(prepared);

    // assert
    assert.deepStrictEqual(commit, { stagedNames: [], recorded: [], warnings: [] });
    assert.strictEqual(await pathExists(locations.mcpJsonPath), false);
  });
});

describe("abortPreparedMcp", () => {
  test("leaves a staged document in memory without materializing output", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-abort-staged-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { command: "node" } },
    });

    // act
    const aborted = abortPreparedMcp(prepared);

    // assert
    assert.strictEqual(aborted, undefined);
    assert.strictEqual(await pathExists(locations.mcpJsonPath), false);
  });

  test("accepts a no-op handle without materializing output", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-abort-noop-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "empty-plugin",
      pluginRoot: path.join(cwd, "plugins", "empty-plugin"),
      pluginData: path.join(cwd, "data", "empty-plugin"),
      servers: {},
    });

    // act
    const aborted = abortPreparedMcp(prepared);

    // assert
    assert.strictEqual(aborted, undefined);
    assert.strictEqual(await pathExists(locations.mcpJsonPath), false);
  });
});
