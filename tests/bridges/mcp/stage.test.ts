import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedMcp,
  commitPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  McpConfigFileError,
  McpServerCollisionError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

async function createProjectScope(
  t: TestContext,
  prefix: string,
): Promise<{ cwd: string; locations: ReturnType<typeof locationsFor> }> {
  const { cwd } = await createHermeticEnvironment(t, prefix);
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
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });

  test("rejects a project server that collides with an ambient user-scope MCP server", async (t) => {
    // arrange -- same hermetic environment for both the ambient user-scope
    // file and the project scope, so the ambient file lands in the exact
    // pi-user-scope collision slot the project stage checks (MC-4).
    const { cwd } = await createHermeticEnvironment(t, "mcp-stage-ambient-");
    const ambientMcpPath = locationsFor("user", "/ambient-cwd").mcpJsonPath;
    const ambientBytes = '{"mcpServers":{"ambient":{"command":"host-only"}}}\n';
    await mkdir(path.dirname(ambientMcpPath), { recursive: true });
    await writeFile(ambientMcpPath, ambientBytes);
    const locations = locationsFor("project", cwd);

    // act
    const collision = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { ambient: { command: "case-owned" } },
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
        message: `Refusing to stage MCP server "ambient": already exists in ${ambientMcpPath}.`,
        serverName: "ambient",
        owningPath: ambientMcpPath,
      },
    );
    assert.strictEqual(await readFile(ambientMcpPath, "utf8"), ambientBytes);
  });

  test("replaces owned servers and preserves complete foreign content", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-merge-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"foreignTopLevel":{"enabled":true},"mcpServers":{"foreign":{"command":"foreign-command","env":{"TOKEN":"foreign-token"},"_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}},"current":{"command":"old-command","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
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
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [],
    });
  });

  test("stages an empty set when previous owned servers must be removed", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-drop-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
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

  for (const { description, storedBytes, defect } of [
    {
      description: "an unterminated block comment",
      storedBytes: '{"mcpServers":{} /* open\n',
      defect: "invalid-jsonc",
    },
    {
      description: "an unquoted token value",
      storedBytes: '{"a": sk-secret-abc}\n',
      defect: "invalid-jsonc",
    },
    { description: "a top-level array", storedBytes: "[]\n", defect: "top-level-not-object" },
    {
      description: "a null mcpServers field",
      storedBytes: '{"foreignTopLevel":"keep","mcpServers":null}\n',
      defect: "mcpServers-not-object",
    },
    {
      description: "a string mcpServers field",
      storedBytes: '{"foreignTopLevel":"keep","mcpServers":"foreign"}\n',
      defect: "mcpServers-not-object",
    },
    {
      description: "an array mcpServers field",
      storedBytes: '{"foreignTopLevel":"keep","mcpServers":[{"command":"foreign"}]}\n',
      defect: "mcpServers-not-object",
    },
    {
      description: "a boolean mcpServers field",
      storedBytes: '{"foreignTopLevel":"keep","mcpServers":true}\n',
      defect: "mcpServers-not-object",
    },
    {
      description: "a number mcpServers field",
      storedBytes: '{"foreignTopLevel":"keep","mcpServers":17}\n',
      defect: "mcpServers-not-object",
    },
    {
      description: "a string mcp-servers field",
      storedBytes: '{"mcp-servers":"x"}\n',
      defect: "mcp-servers-not-object",
    },
  ] as const) {
    test(`AFILE-02: an MCP install over ${description} rejects and keeps the bytes`, async (t) => {
      // arrange
      const { cwd, locations } = await createProjectScope(t, "mcp-stage-refusal-");
      await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
      await writeFile(locations.mcpAdapterJsonPath, storedBytes, "utf8");
      const storedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });

      // act & assert
      await assert.rejects(
        () =>
          prepareStageMcpServers({
            locations,
            cwd,
            marketplaceName: "catalog",
            pluginName: "acme",
            pluginRoot: path.join(cwd, "plugins", "acme"),
            pluginData: path.join(cwd, "data", "acme"),
            servers: { server: { url: "https://mcp.example.test" } },
          }),
        (error: unknown) => {
          assert.ok(error instanceof McpConfigFileError);
          assert.deepStrictEqual(
            { filePath: error.filePath, defect: error.defect, cause: error.cause },
            { filePath: locations.mcpAdapterJsonPath, defect, cause: undefined },
          );
          return true;
        },
      );
      const retainedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
      const retainedMetadata = await stat(locations.mcpAdapterJsonPath, { bigint: true });
      assert.strictEqual(retainedBytes, storedBytes);
      assert.deepStrictEqual(
        {
          ino: retainedMetadata.ino,
          size: retainedMetadata.size,
          mtimeNs: retainedMetadata.mtimeNs,
          ctimeNs: retainedMetadata.ctimeNs,
        },
        {
          ino: storedMetadata.ino,
          size: storedMetadata.size,
          mtimeNs: storedMetadata.mtimeNs,
          ctimeNs: storedMetadata.ctimeNs,
        },
      );
    });
  }

  test("AFILE-02: an empty staged set over an unparseable file is a noop naming the file", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-unparseable-noop-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, "{");

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
    await commitPreparedMcp(prepared);

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: {
        stagedNames: [],
        recorded: [],
        warnings: [
          `MCP config ${locations.mcpAdapterJsonPath} is not valid JSONC; it was left unchanged.`,
        ],
      },
    });
    assert.strictEqual(Object.isFrozen(prepared.result.warnings), true);
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{");
  });

  test("AFILE-02: staging over a commented file keeps every foreign key in place", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-jsonc-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      [
        "﻿// user config",
        "{",
        '  "settings": { "toolPrefix": "short" },',
        '  "mcpServers": {',
        '    "mine": { "command": "my-server" }, // user server',
        "  },",
        '  "imports": ["claude-code"],',
        '  "claudePlugins": { "enabled": true },',
        '  "custom": 1,',
        "}",
        "",
      ].join("\n"),
    );
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { url: "https://mcp.example.test" } },
    });

    // act
    await commitPreparedMcp(prepared);

    // assert
    assert.strictEqual(
      await readFile(locations.mcpAdapterJsonPath, "utf8"),
      [
        "{",
        '  "settings": {',
        '    "toolPrefix": "short"',
        "  },",
        '  "mcpServers": {',
        '    "mine": {',
        '      "command": "my-server"',
        "    },",
        '    "server": {',
        '      "url": "https://mcp.example.test",',
        '      "_piClaudeMarketplace": {',
        '        "plugin": "acme",',
        '        "marketplace": "catalog"',
        "      }",
        "    }",
        "  },",
        '  "imports": [',
        '    "claude-code"',
        "  ],",
        '  "claudePlugins": {',
        '    "enabled": true',
        "  },",
        '  "custom": 1',
        "}",
        "",
      ].join("\n"),
    );
  });

  test("AFILE-03: an mcp-servers-only file gets the entry under mcp-servers", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-legacy-key-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"mcp-servers":{"mine":{"command":"my-server"}}}',
    );

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
      "mcp-servers": {
        mine: { command: "my-server" },
        server: {
          url: "https://mcp.example.test",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("AFILE-03: a both-keys file gets the entry under mcpServers and drops the stale copy", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-both-keys-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      JSON.stringify({
        "mcp-servers": {
          legacy: { command: "legacy-server" },
          server: {
            command: "stale",
            _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
          },
        },
        mcpServers: { mine: { command: "my-server" } },
      }),
    );

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
      "mcp-servers": { legacy: { command: "legacy-server" } },
      mcpServers: {
        mine: { command: "my-server" },
        server: {
          url: "https://mcp.example.test",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("AFILE-01: staging into an absent target leaves no mcp.json behind", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-no-legacy-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { url: "https://mcp.example.test" } },
    });

    // act
    await commitPreparedMcp(prepared);

    // assert
    assert.deepStrictEqual(
      {
        adapter: await pathExists(locations.mcpAdapterJsonPath),
        legacy: await pathExists(locations.mcpJsonPath),
      },
      { adapter: true, legacy: false },
    );
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
        urlWithScalarEnv: { url: "https://mcp.example.test", env: "opaque" },
        scalar: "invalid",
        nil: null,
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
      'mcp server "nil": entry is not an object; staged as an empty entry',
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
        urlWithScalarEnv: {
          url: "https://mcp.example.test",
          env: "opaque",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
        scalar: {
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
        nil: {
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("treats a non-directory parent as an absent scoped document", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-not-directory-");
    await writeFile(path.dirname(locations.mcpAdapterJsonPath), "not-a-directory");

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
  });

  test("propagates a non-missing scoped document read failure", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-read-failure-");
    await mkdir(locations.mcpAdapterJsonPath, { recursive: true });

    // act & assert
    await assert.rejects(
      () =>
        prepareStageMcpServers({
          locations,
          cwd,
          marketplaceName: "catalog",
          pluginName: "acme",
          pluginRoot: path.join(cwd, "plugins", "acme"),
          pluginData: path.join(cwd, "data", "acme"),
          servers: { server: { command: "node" } },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        const filesystemError = error as NodeJS.ErrnoException;
        assert.deepStrictEqual(
          {
            // The errno message is not projected: later runtime majors append the offending path
            // to it. The code and syscall it derives from are the contract.
            name: filesystemError.name,
            code: filesystemError.code,
            syscall: filesystemError.syscall,
          },
          {
            name: "Error",
            code: "EISDIR",
            syscall: "read",
          },
        );
        return true;
      },
    );
  });

  test("rejects a foreign server in the scoped document", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-scope-collision-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
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
        message: `Refusing to stage MCP server "duplicate": already exists in ${locations.mcpAdapterJsonPath}.`,
        serverName: "duplicate",
        owningPath: locations.mcpAdapterJsonPath,
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
    const { cwd } = await createHermeticEnvironment(t, "mcp-stage-user-");
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
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(commit, {
      stagedNames: ["local"],
      recorded: [{ generatedName: "local", sourcePath, targetPath: locations.mcpAdapterJsonPath }],
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
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
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
    abortPreparedMcp(prepared);
    const materialized = await pathExists(locations.mcpAdapterJsonPath);

    // assert
    assert.strictEqual(materialized, false);
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
    abortPreparedMcp(prepared);
    const materialized = await pathExists(locations.mcpAdapterJsonPath);

    // assert
    assert.strictEqual(materialized, false);
  });
});

describe("replacePreparedMcp", () => {
  test("returns a no-op replacement without materializing output", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-replace-noop-");
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
    const replacement = await replacePreparedMcp(prepared);

    // assert
    assert.deepStrictEqual(replacement, { kind: "noop", prepared });
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });

  test("atomically replaces exact previous bytes", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-replace-existing-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    const previousBytes =
      '{"foreignTopLevel":"keep","mcpServers":{"foreign":{"url":"https://foreign.example.test"}}}\n';
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, previousBytes);
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginData,
      servers: { owned: { command: "node" } },
    });
    const expectedBytes = `{
  "foreignTopLevel": "keep",
  "mcpServers": {
    "foreign": {
      "url": "https://foreign.example.test"
    },
    "owned": {
      "command": "node",
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
    const replacement = await replacePreparedMcp(prepared);
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(replacement, { kind: "replaced", prepared });
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("propagates a replacement read failure before committing", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-replace-read-failure-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { command: "node" } },
    });
    await mkdir(locations.mcpAdapterJsonPath, { recursive: true });

    // act & assert
    await assert.rejects(
      () => replacePreparedMcp(prepared),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        const filesystemError = error as NodeJS.ErrnoException;
        assert.deepStrictEqual(
          {
            // The errno message is not projected: later runtime majors append the offending path
            // to it. The code and syscall it derives from are the contract.
            name: filesystemError.name,
            code: filesystemError.code,
            syscall: filesystemError.syscall,
          },
          {
            name: "Error",
            code: "EISDIR",
            syscall: "read",
          },
        );
        return true;
      },
    );
  });
});

describe("rollbackMcpReplacement", () => {
  test("returns a frozen empty leak list for a no-op replacement", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-rollback-noop-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "empty-plugin",
      pluginRoot: path.join(cwd, "plugins", "empty-plugin"),
      pluginData: path.join(cwd, "data", "empty-plugin"),
      servers: {},
    });
    const replacement = await replacePreparedMcp(prepared);

    // act
    const leaks = await rollbackMcpReplacement(replacement);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
  });

  test("removes mcp-adapter.json when replacement created the document", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-rollback-created-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { command: "node" } },
    });
    const replacement = await replacePreparedMcp(prepared);

    // act
    const leaks = await rollbackMcpReplacement(replacement);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });

  test("restores exact previous bytes after replacement", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-rollback-existing-");
    const previousBytes =
      '{\n  "foreignTopLevel": "keep-shape",\n  "mcpServers": {\n    "foreign": {\n      "command": "foreign"\n    }\n  }\n}\n';
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, previousBytes);
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { owned: { command: "node" } },
    });
    const replacement = await replacePreparedMcp(prepared);

    // act
    const leaks = await rollbackMcpReplacement(replacement);
    const restoredBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
    assert.strictEqual(restoredBytes, previousBytes);
  });

  test("records a complete leak when the previous bytes cannot be restored", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-rollback-leak-");
    const parentDirectory = path.dirname(locations.mcpAdapterJsonPath);
    await mkdir(parentDirectory, { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, '{"mcpServers":{"foreign":{"command":"old"}}}\n');
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { owned: { command: "node" } },
    });
    const replacement = await replacePreparedMcp(prepared);
    await rm(parentDirectory, { recursive: true, force: true });
    await writeFile(parentDirectory, "blocks-directory-creation");

    // act
    const leaks = await rollbackMcpReplacement(replacement);

    // assert
    assert.deepStrictEqual(leaks, [
      `failed to restore mcp-adapter.json at ${locations.mcpAdapterJsonPath}: EEXIST: file already exists, mkdir '${parentDirectory}'`,
    ]);
    assert.strictEqual(Object.isFrozen(leaks), true);
    assert.strictEqual(await readFile(parentDirectory, "utf8"), "blocks-directory-creation");
  });
});

describe("finalizeMcpReplacement", () => {
  test("returns a frozen empty leak list for no-op and replaced handles", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-finalize-");
    const noopPrepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "empty-plugin",
      pluginRoot: path.join(cwd, "plugins", "empty-plugin"),
      pluginData: path.join(cwd, "data", "empty-plugin"),
      servers: {},
    });
    const noopReplacement = await replacePreparedMcp(noopPrepared);
    const stagedPrepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { command: "node" } },
    });
    const replaced = await replacePreparedMcp(stagedPrepared);

    // act
    const noopLeaks = finalizeMcpReplacement(noopReplacement);
    const replacementLeaks = finalizeMcpReplacement(replaced);

    // assert
    assert.deepStrictEqual(noopLeaks, []);
    assert.strictEqual(Object.isFrozen(noopLeaks), true);
    assert.deepStrictEqual(replacementLeaks, []);
    assert.strictEqual(Object.isFrozen(replacementLeaks), true);
  });

  test("rejects an unknown replacement handle", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-finalize-unknown-");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { command: "node" } },
    });
    const replacement = await replacePreparedMcp(prepared);
    assert.strictEqual(replacement.kind, "replaced");
    t.after(() => finalizeMcpReplacement(replacement));
    const { locations: replacementLocations, ...cloneablePrepared } = replacement.prepared;
    const clonedReplacement = structuredClone({ ...replacement, prepared: cloneablePrepared });
    const unknownReplacement = {
      ...clonedReplacement,
      prepared: { ...clonedReplacement.prepared, locations: replacementLocations },
    } satisfies typeof replacement;

    // act & assert
    assert.throws(
      () => finalizeMcpReplacement(unknownReplacement),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message, cause: error.cause },
          { name: "Error", message: "Unknown MCP replacement handle.", cause: undefined },
        );
        return true;
      },
    );
  });
});
