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
  McpServerKeyCollisionError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { PreparedMcpStaging } from "../../../extensions/pi-claude-marketplace/bridges/mcp/types.ts";

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

async function writeSource(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
}

/** Prepares the `acme` plugin's single `server` entry, a URL transport with no env injection. */
function prepareAcme(
  locations: ReturnType<typeof locationsFor>,
  cwd: string,
): Promise<PreparedMcpStaging> {
  return prepareStageMcpServers({
    locations,
    cwd,
    marketplaceName: "catalog",
    pluginName: "acme",
    pluginRoot: path.join(cwd, "plugins", "acme"),
    pluginData: path.join(cwd, "data", "acme"),
    servers: { server: { type: "http", url: "https://acme.example/mcp" } },
  });
}

/** Prepares `pluginName`'s declared servers, each a URL transport with no env injection. */
function preparePlugin(
  locations: ReturnType<typeof locationsFor>,
  cwd: string,
  pluginName: string,
  serverNames: readonly string[],
): Promise<PreparedMcpStaging> {
  return prepareStageMcpServers({
    locations,
    cwd,
    marketplaceName: "catalog",
    pluginName,
    pluginRoot: path.join(cwd, "plugins", pluginName),
    pluginData: path.join(cwd, "data", pluginName),
    servers: Object.fromEntries(
      serverNames.map((serverName) => [serverName, { type: "http", url: "https://x.example/mcp" }]),
    ),
  });
}

function foldedCollisionFields(collision: McpServerCollisionError): Record<string, unknown> {
  return { ...collisionFields(collision), definedAs: collision.definedAs };
}

function keyCollisionFields(collision: McpServerKeyCollisionError): Record<string, unknown> {
  return {
    name: collision.name,
    message: collision.message,
    pluginName: collision.pluginName,
    servers: collision.servers,
    keys: collision.keys,
  };
}

async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return pending.then(
    () => undefined,
    (error: unknown) => error,
  );
}

function collisionFields(collision: McpServerCollisionError): Record<string, string> {
  return {
    name: collision.name,
    message: collision.message,
    serverName: collision.serverName,
    owningPath: collision.owningPath,
    winningPath: collision.winningPath,
  };
}

const ACME_ONLY_BYTES = `{
  "mcpServers": {
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

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
      result: { stagedNames: [], recorded: [], warnings: [], notices: [] },
    });
    assert.strictEqual(Object.isFrozen(prepared.result.stagedNames), true);
    assert.strictEqual(Object.isFrozen(prepared.result.recorded), true);
    assert.strictEqual(Object.isFrozen(prepared.result.warnings), true);
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });

  test("replaces owned servers and preserves complete foreign content", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-merge-");
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"foreignTopLevel":{"enabled":true},"mcpServers":{"foreign":{"command":"foreign-command","env":{"TOKEN":"foreign-token"},"_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}},"plugin_acme_current_":{"command":"old-command","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );
    const expectedDoc = {
      foreignTopLevel: { enabled: true },
      mcpServers: {
        foreign: {
          command: "foreign-command",
          env: { TOKEN: "foreign-token" },
          _piClaudeMarketplace: { plugin: "other", marketplace: "catalog" },
        },
        plugin_acme_current_: {
          command: path.join(pluginRoot, "bin", "server"),
          args: ["--data", pluginData],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
            CLAUDE_PROJECT_DIR: cwd,
            CUSTOM: path.join(pluginData, "custom"),
          },
          directTools: "search",
          toolPrefix: "mcp",
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
      notices: [],
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
    assert.deepStrictEqual(prepared.result, {
      stagedNames: [],
      recorded: [],
      warnings: [],
      notices: [],
    });
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
            servers: { server: { type: "http", url: "https://mcp.example.test" } },
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

  test("AFILE-02: an empty staged set over an unparseable file is a noop that reports it left unchanged", async (t) => {
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
        warnings: [],
        notices: [{ kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" }],
      },
    });
    assert.strictEqual(Object.isFrozen(prepared.result.notices), true);
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
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
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
        '    "plugin_acme_server_": {',
        '      "url": "https://mcp.example.test",',
        '      "directTools": "search",',
        '      "toolPrefix": "mcp",',
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

  test("AFILE-04: staging over a commented file reports that its comments are dropped", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-comments-notice-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{\n  // mine\n  "mcpServers": { "mine": { "command": "my-server" } }\n}\n',
    );

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
    });

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["server"],
      recorded: [
        {
          generatedName: "server",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [],
      notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
    });
    assert.strictEqual(Object.isFrozen(prepared.result.notices), true);
  });

  test("AFILE-04: a trailing comma alone is not a comment and reports no notice", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-trailing-comma-");
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"mine":{"command":"my-server"},},}',
    );

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
    });

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["server"],
      recorded: [
        {
          generatedName: "server",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [],
      notices: [],
    });
  });

  test("AFILE-04: a noop over a commented file keeps its bytes and reports no notice", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-comments-noop-");
    const storedBytes = '{\n  // mine\n  "mcpServers": { "mine": { "command": "my-server" } }\n}\n';
    await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
    await writeFile(locations.mcpAdapterJsonPath, storedBytes);

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
      result: { stagedNames: [], recorded: [], warnings: [], notices: [] },
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), storedBytes);
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
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    if (prepared.kind !== "staged") {
      return;
    }

    assert.deepStrictEqual(prepared._nextDoc, {
      "mcp-servers": {
        mine: { command: "my-server" },
        plugin_acme_server_: {
          url: "https://mcp.example.test",
          directTools: "search",
          toolPrefix: "mcp",
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
          plugin_acme_server_: {
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
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
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
        plugin_acme_server_: {
          url: "https://mcp.example.test",
          directTools: "search",
          toolPrefix: "mcp",
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
      servers: { server: { type: "http", url: "https://mcp.example.test" } },
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

  test("returns the stamping warnings in the commit result", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-warnings-");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { scalar: "invalid" },
    });

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["scalar"],
      recorded: [
        {
          generatedName: "scalar",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [
        'mcp server "plugin_acme_scalar_": entry is not an object; staged as an empty entry',
      ],
      notices: [],
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
      result: { stagedNames: [], recorded: [], warnings: [], notices: [] },
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

  test("AFILE-05: a full definition in ~/.agents/mcp.json refuses a user-scope install", async (t) => {
    // arrange
    const { cwd, home } = await createHermeticEnvironment(t, "mcp-stage-agents-collision-");
    const locations = locationsFor("user", cwd);
    const agentsPath = path.join(home, ".agents", "mcp.json");
    await writeSource(agentsPath, '{"mcpServers":{"plugin_acme_server_":{"command":"user"}}}');

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${agentsPath} already defines it, and pi-mcp-adapter would load the definition in ${locations.mcpAdapterJsonPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: agentsPath,
      winningPath: locations.mcpAdapterJsonPath,
    });
    assert.strictEqual(await pathExists(locations.mcpAdapterJsonPath), false);
  });

  test("AFILE-05: a full definition in the project .mcp.json refuses a user-scope install", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mcp-stage-project-collision-");
    const locations = locationsFor("user", cwd);
    const projectPath = path.join(cwd, ".mcp.json");
    await writeSource(
      projectPath,
      '{"mcpServers":{"plugin_acme_server_":{"url":"https://project.example"}}}',
    );

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${projectPath} already defines it, and pi-mcp-adapter would load the definition in ${projectPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: projectPath,
      winningPath: projectPath,
    });
  });

  test("AFILE-05: a marker-less full definition in the target file refuses", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-target-collision-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"command":"user"}}}',
    );

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${locations.mcpAdapterJsonPath} already defines it, and pi-mcp-adapter would load the definition in ${locations.mcpAdapterJsonPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: locations.mcpAdapterJsonPath,
      winningPath: locations.mcpAdapterJsonPath,
    });
  });

  test("AFILE-05: a foreign full definition under the loaded key refuses when the plugin's entry sits under the shadowed key", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-shadowed-self-");
    const previousBytes =
      '{"mcpServers":{"plugin_acme_server_":{"command":"user-own-server","env":{"TOKEN":"secret"}}},' +
      '"mcp-servers":{"plugin_acme_server_":{"command":"plugin-old","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}';
    await writeSource(locations.mcpAdapterJsonPath, previousBytes);

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${locations.mcpAdapterJsonPath} already defines it, and pi-mcp-adapter would load the definition in ${locations.mcpAdapterJsonPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: locations.mcpAdapterJsonPath,
      winningPath: locations.mcpAdapterJsonPath,
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), previousBytes);
  });

  test("AFILE-05: another plugin's marked partial entry in the target file refuses", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-foreign-partial-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true,"_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}}}}',
    );

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${locations.mcpAdapterJsonPath} already defines it, and pi-mcp-adapter would load the definition in ${locations.mcpAdapterJsonPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: locations.mcpAdapterJsonPath,
      winningPath: locations.mcpAdapterJsonPath,
    });
  });

  test("AFILE-05: names the highest-precedence declarer when several sources define the name", async (t) => {
    // arrange
    const { cwd, home } = await createHermeticEnvironment(t, "mcp-stage-many-collision-");
    const locations = locationsFor("user", cwd);
    const piProjectPath = path.join(cwd, ".pi", "mcp.json");
    await writeSource(
      path.join(home, ".config", "mcp", "mcp.json"),
      '{"mcpServers":{"plugin_acme_server_":{"command":"shared"}}}',
    );
    await writeSource(
      piProjectPath,
      '{"mcpServers":{"plugin_acme_server_":{"command":"pi-project"}}}',
    );
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"command":"user"}}}',
    );

    // act
    const collision = await rejectionOf(prepareAcme(locations, cwd));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_server_": ${piProjectPath} already defines it, and pi-mcp-adapter would load the definition in ${piProjectPath}.`,
      serverName: "plugin_acme_server_",
      owningPath: piProjectPath,
      winningPath: piProjectPath,
    });
  });

  test("AFILE-05: a disable stub in the project mcp-adapter.json does not block a user-scope install", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mcp-stage-stub-");
    const locations = locationsFor("user", cwd);
    await writeSource(
      path.join(cwd, ".pi", "mcp-adapter.json"),
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true}}}',
    );

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, ACME_ONLY_BYTES);
  });

  test("AFILE-05: the plugin's own entry in the same scope's legacy mcp.json does not block its update", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-own-legacy-");
    await writeSource(
      locations.mcpJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"command":"old","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, ACME_ONLY_BYTES);
  });

  test("AFILE-05: the plugin's own entry in the other scope's mcp-adapter.json does not block its install", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-own-other-adapter-");
    await writeSource(
      locationsFor("user", cwd).mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"command":"user-copy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, ACME_ONLY_BYTES);
  });

  test("AFILE-05: the plugin's own entry in the other scope's legacy mcp.json does not block its install", async (t) => {
    // arrange
    const { agentDir, cwd } = await createHermeticEnvironment(t, "mcp-stage-own-other-legacy-");
    const locations = locationsFor("project", cwd);
    await writeSource(
      path.join(agentDir, "mcp.json"),
      '{"mcpServers":{"plugin_acme_server_":{"command":"user-copy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, ACME_ONLY_BYTES);
  });

  test("AFILE-05: the plugin's own entry in an ancestor mcp-adapter.json does not block its install", async (t) => {
    // arrange
    const { home } = await createHermeticEnvironment(t, "mcp-stage-own-ancestor-");
    const cwd = path.join(home, "work", "repo");
    await mkdir(cwd, { recursive: true });
    const locations = locationsFor("project", cwd);
    await writeSource(
      path.join(home, ".agents", "mcp.json"),
      '{"settings":{"ancestorConfigRoots":["~/work"]}}',
    );
    await writeSource(
      path.join(home, "work", ".pi", "mcp-adapter.json"),
      '{"mcpServers":{"plugin_acme_server_":{"command":"ancestor-copy","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, ACME_ONLY_BYTES);
  });

  test("AFILE-05: the staged entry replaces a marker-less overlay under its name and keeps its disabled flag", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-overlay-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true},"mine":{"command":"mine"}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "mine": {
      "command": "mine"
    },
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "keptOverride": {
          "disabled": true
        }
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("AFILE-06: absorbs a disable stub's carried fields, keeps the whole stub in the marker, and activates none of its credentials", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-absorb-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      JSON.stringify({
        mcpServers: {
          plugin_acme_server_: {
            disabled: true,
            env: { STUB_TOKEN: "stub-env" },
            headers: { Authorization: "stub-header" },
            bearerToken: "t",
          },
        },
      }),
    );
    const pluginRoot = path.join(cwd, "plugins", "acme");
    const pluginData = path.join(cwd, "data", "acme");
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_server_": {
      "command": "acme",
      "env": {
        "CLAUDE_PLUGIN_ROOT": ${JSON.stringify(pluginRoot)},
        "CLAUDE_PLUGIN_DATA": ${JSON.stringify(pluginData)},
        "CLAUDE_PROJECT_DIR": ${JSON.stringify(cwd)},
        "PLUGIN_TOKEN": "plugin-env"
      },
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "keptOverride": {
          "disabled": true,
          "env": {
            "STUB_TOKEN": "stub-env"
          },
          "headers": {
            "Authorization": "stub-header"
          },
          "bearerToken": "t"
        }
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(
      await prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginData,
        servers: { server: { command: "acme", env: { PLUGIN_TOKEN: "plugin-env" } } },
      }),
    );
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("AFILE-06: staging the same plugin version twice writes identical bytes", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-idempotent-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "keptOverride": {
          "disabled": true
        }
      }
    }
  }
}
`;
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const firstBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const secondBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(firstBytes, expectedBytes);
    assert.strictEqual(secondBytes, expectedBytes);
  });

  test("AFILE-06: restaging an entry that keeps an override carries the override forward unchanged", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-kept-restage-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"url":"https://old.example/mcp","disabled":true,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true,"env":{"STUB_TOKEN":"stub-secret"}}}}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "keptOverride": {
          "disabled": true,
          "env": {
            "STUB_TOKEN": "stub-secret"
          }
        }
      }
    }
  }
}
`;
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const firstBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const secondBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(firstBytes, expectedBytes);
    assert.strictEqual(secondBytes, expectedBytes);
  });

  test("AFILE-06: staging over a stub with env and headers reports one override-kept notice naming them", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-override-notice-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true,"env":{"STUB_TOKEN":"stub-secret"},"headers":{"Authorization":"stub-header"}}}}',
    );

    // act
    const prepared = await prepareAcme(locations, cwd);

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["server"],
      recorded: [
        {
          generatedName: "server",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [],
      notices: [
        {
          kind: "override-kept",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "plugin_acme_server_",
          fields: ["env", "headers"],
        },
      ],
    });
  });

  test("ANAME-07: staging a plugin timeout over a stub's timeout writes the plugin's value and names the stub's", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-plugin-set-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"requestTimeoutMs":5000,"disabled":true}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "requestTimeoutMs": 60000,
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "pluginSetFields": [
          "requestTimeoutMs"
        ],
        "keptOverride": {
          "requestTimeoutMs": 5000,
          "disabled": true
        }
      }
    }
  }
}
`;

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: { server: { type: "http", url: "https://acme.example/mcp", timeout: 60000 } },
    });
    await commitPreparedMcp(prepared);
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
    assert.deepStrictEqual(prepared.result.notices, [
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_server_",
        fields: ["requestTimeoutMs"],
      },
    ]);
  });

  test("AFILE-06: override-kept notices follow the plugin's declared server order", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-override-order-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_alpha_":{"env":{"ALPHA":"alpha-secret"}},"plugin_acme_beta_":{"debug":true,"cwd":"/beta"}}}',
    );

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: path.join(cwd, "plugins", "acme"),
      pluginData: path.join(cwd, "data", "acme"),
      servers: {
        beta: { type: "http", url: "https://beta.example/mcp" },
        alpha: { type: "http", url: "https://alpha.example/mcp" },
      },
    });

    // assert
    assert.deepStrictEqual(prepared.result.notices, [
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_beta_",
        fields: ["cwd"],
      },
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_alpha_",
        fields: ["env"],
      },
    ]);
  });

  test("AFILE-06: staging over a disable-only stub reports no notice", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-override-carried-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"disabled":true}}}',
    );

    // act
    const prepared = await prepareAcme(locations, cwd);

    // assert
    assert.deepStrictEqual(prepared.result.notices, []);
  });

  test("AFILE-06: restaging an entry that keeps an override reports no notice", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-override-restage-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_server_":{"url":"https://old.example/mcp","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"env":{"STUB_TOKEN":"stub-secret"}}}}}}',
    );

    // act
    const prepared = await prepareAcme(locations, cwd);

    // assert
    assert.deepStrictEqual(prepared.result.notices, []);
  });

  test("AFILE-06: a commented file holding a stub with env reports the comments, then the override", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-override-comments-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{\n  // mine\n  "mcpServers": { "plugin_acme_server_": { "env": { "STUB_TOKEN": "stub-secret" } } }\n}\n',
    );

    // act
    const prepared = await prepareAcme(locations, cwd);

    // assert
    assert.deepStrictEqual(prepared.result.notices, [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "acme",
        server: "plugin_acme_server_",
        fields: ["env"],
      },
    ]);
  });

  test("AFILE-01: a stage that drops a server writes its kept override back marker-less in place", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-kept-dropped-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"mine":{"command":"mine"},"old":{"url":"https://old.example/mcp","disabled":true,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true}}},"last":{"command":"last"}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "mine": {
      "command": "mine"
    },
    "old": {
      "disabled": true
    },
    "last": {
      "command": "last"
    },
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("AFILE-03: an entry keeping an override under mcp-servers writes it back there when the new entry goes under mcpServers", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-kept-moved-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"mine":{"command":"mine"}},"mcp-servers":{"plugin_acme_server_":{"url":"https://old.example/mcp","disabled":true,"_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog","keptOverride":{"disabled":true}}}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "mine": {
      "command": "mine"
    },
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  },
  "mcp-servers": {
    "plugin_acme_server_": {
      "disabled": true
    }
  }
}
`;

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("AFILE-03: with an mcp-servers-only file the override is kept and written back under mcp-servers", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-kept-legacy-key-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcp-servers":{"plugin_acme_server_":{"disabled":true}}}',
    );
    const expectedStagedBytes = `{
  "mcp-servers": {
    "plugin_acme_server_": {
      "url": "https://acme.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "disabled": true,
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog",
        "keptOverride": {
          "disabled": true
        }
      }
    }
  }
}
`;
    const expectedRestoredBytes = `{
  "mcp-servers": {
    "plugin_acme_server_": {
      "disabled": true
    }
  }
}
`;

    // act
    await commitPreparedMcp(await prepareAcme(locations, cwd));
    const stagedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await commitPreparedMcp(
      await prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot: path.join(cwd, "plugins", "acme"),
        pluginData: path.join(cwd, "data", "acme"),
        servers: {},
      }),
    );
    const restoredBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(stagedBytes, expectedStagedBytes);
    assert.strictEqual(restoredBytes, expectedRestoredBytes);
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
        plugin_acme_server_: {
          command: "${CLAUDE_PROJECT_DIR}/server",
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
          },
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "acme", marketplace: "catalog" },
        },
      },
    });
  });

  test("AVAR-02: a project-scope stage writes Claude's variable rule for pi-mcp-adapter and no environment value", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-avar-tracer-");
    const pluginRoot = path.join(cwd, "plugins", "hello");
    const pluginData = path.join(cwd, "data", "hello");
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "hello",
      pluginRoot,
      pluginData,
      env: { PI_CM_AVAR_TOKEN: "avar-sentinel-04-01" },
      servers: {
        srv: {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
          args: [
            "--project",
            "${CLAUDE_PROJECT_DIR}",
            "--site",
            "${PI_CM_AVAR_SITE}",
            "--level",
            "${PI_CM_AVAR_LEVEL:-info}",
            "--token",
            "${PI_CM_AVAR_TOKEN}",
          ],
          env: { MODE: "!fast" },
        },
      },
    });

    // act
    await commitPreparedMcp(prepared);
    const writtenText = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(JSON.parse(writtenText), {
      mcpServers: {
        plugin_hello_srv_: {
          command: `${pluginRoot}/bin/server`,
          args: [
            "--project",
            cwd,
            "--site",
            "${PI_CM_AVAR_SITE}",
            "--level",
            "info",
            "--token",
            "${PI_CM_AVAR_TOKEN}",
          ],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
            CLAUDE_PROJECT_DIR: cwd,
            MODE: "!!fast",
          },
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "hello", marketplace: "catalog" },
        },
      },
    });
    assert.strictEqual(writtenText.includes("avar-sentinel-04-01"), false);
  });

  test("AVAR-02: no referenced variable's value reaches the staged document", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-avar-sentinel-");
    const sentinels = {
      PI_CM_AVAR_COMMAND: "sentinel-command",
      PI_CM_AVAR_ARG: "sentinel-arg",
      PI_CM_AVAR_ENV: "sentinel-env",
      PI_CM_AVAR_URL: "sentinel-url",
      PI_CM_AVAR_HEADER: "sentinel-header",
    };

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "hello",
      pluginRoot: path.join(cwd, "plugins", "hello"),
      pluginData: path.join(cwd, "data", "hello"),
      env: sentinels,
      servers: {
        local: {
          command: "${PI_CM_AVAR_COMMAND}",
          args: ["${PI_CM_AVAR_ARG:-unset}"],
          env: { VALUE: "${PI_CM_AVAR_ENV}" },
        },
        remote: {
          type: "http",
          url: "https://${PI_CM_AVAR_URL}/mcp",
          headers: { Authorization: "Bearer ${PI_CM_AVAR_HEADER}" },
        },
      },
    });
    const preparedText = JSON.stringify(prepared);

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(
      Object.values(sentinels).filter((sentinel) => preparedText.includes(sentinel)),
      [],
    );
  });

  test("AVAR-02: a stage without an injected env reads Pi's process environment", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-avar-process-env-");
    const previousValue = process.env.PI_CM_AVAR_PROCESS;
    process.env.PI_CM_AVAR_PROCESS = "process-value";
    t.after(() => {
      if (previousValue === undefined) {
        delete process.env.PI_CM_AVAR_PROCESS;
      } else {
        process.env.PI_CM_AVAR_PROCESS = previousValue;
      }
    });
    const pluginRoot = path.join(cwd, "plugins", "hello");
    const pluginData = path.join(cwd, "data", "hello");

    // act
    const prepared = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: "catalog",
      pluginName: "hello",
      pluginRoot,
      pluginData,
      servers: { local: { command: "server", args: ["${PI_CM_AVAR_PROCESS:-unset}"] } },
    });

    // assert
    assert.deepStrictEqual(prepared.kind === "staged" ? prepared._nextDoc : prepared, {
      mcpServers: {
        plugin_hello_local_: {
          command: "server",
          args: ["${PI_CM_AVAR_PROCESS}"],
          env: {
            CLAUDE_PLUGIN_ROOT: pluginRoot,
            CLAUDE_PLUGIN_DATA: pluginData,
            CLAUDE_PROJECT_DIR: cwd,
          },
          directTools: "search",
          toolPrefix: "mcp",
          _piClaudeMarketplace: { plugin: "hello", marketplace: "catalog" },
        },
      },
    });
  });

  test("ANAME-01: writes each server under its Claude Code key in declared order and records the declared names", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-keys-");
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_db_": {
      "url": "https://db.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    },
    "plugin_acme_my_api_": {
      "url": "https://api.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;
    const stageAcme = (): Promise<PreparedMcpStaging> =>
      prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot: path.join(cwd, "plugins", "acme"),
        pluginData: path.join(cwd, "data", "acme"),
        servers: {
          db: { type: "http", url: "https://db.example/mcp" },
          "my.api": { type: "http", url: "https://api.example/mcp" },
        },
      });

    // act
    const commit = await commitPreparedMcp(await stageAcme());
    const firstBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
    await commitPreparedMcp(await stageAcme());
    const secondBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.deepStrictEqual(commit, {
      stagedNames: ["db", "my.api"],
      recorded: [
        {
          generatedName: "db",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
        {
          generatedName: "my.api",
          sourcePath: "acme#mcpServers",
          targetPath: locations.mcpAdapterJsonPath,
        },
      ],
      warnings: [],
      notices: [],
    });
    assert.strictEqual(firstBytes, expectedBytes);
    assert.strictEqual(secondBytes, expectedBytes);
  });

  test("ANAME-01: a full definition under the plugin's key in ~/.agents/mcp.json refuses and keeps the target bytes", async (t) => {
    // arrange
    const { cwd, home } = await createHermeticEnvironment(t, "mcp-stage-key-collision-");
    const locations = locationsFor("user", cwd);
    const agentsPath = path.join(home, ".agents", "mcp.json");
    const targetBytes = '{"mcpServers":{"mine":{"command":"mine"}}}';
    await writeSource(agentsPath, '{"mcpServers":{"plugin_acme_db_":{"command":"user"}}}');
    await writeSource(locations.mcpAdapterJsonPath, targetBytes);

    // act
    const collision = await rejectionOf(
      prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot: path.join(cwd, "plugins", "acme"),
        pluginData: path.join(cwd, "data", "acme"),
        servers: { db: { type: "http", url: "https://db.example/mcp" } },
      }),
    );

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(collisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_db_": ${agentsPath} already defines it, and pi-mcp-adapter would load the definition in ${locations.mcpAdapterJsonPath}.`,
      serverName: "plugin_acme_db_",
      owningPath: agentsPath,
      winningPath: locations.mcpAdapterJsonPath,
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), targetBytes);
  });

  test("ANAME-01: another plugin's entry for a server of the same declared name does not refuse", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-key-side-by-side-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_other_db_":{"url":"https://other.example/mcp","_piClaudeMarketplace":{"plugin":"other","marketplace":"catalog"}}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_other_db_": {
      "url": "https://other.example/mcp",
      "_piClaudeMarketplace": {
        "plugin": "other",
        "marketplace": "catalog"
      }
    },
    "plugin_acme_db_": {
      "url": "https://db.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(
      await prepareStageMcpServers({
        locations,
        cwd,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot: path.join(cwd, "plugins", "acme"),
        pluginData: path.join(cwd, "data", "acme"),
        servers: { db: { type: "http", url: "https://db.example/mcp" } },
      }),
    );
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("ANAME-03: two servers that normalize to one key refuse before any write", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-same-key-");
    await writeSource(locations.mcpAdapterJsonPath, "{");

    // act
    const collision = await rejectionOf(preparePlugin(locations, cwd, "acme", ["a.b", "a_b"]));

    // assert
    assert.ok(collision instanceof McpServerKeyCollisionError);
    assert.deepStrictEqual(keyCollisionFields(collision), {
      name: "McpServerKeyCollisionError",
      message:
        'Refusing to stage MCP servers "a.b" and "a_b" of plugin "acme": both map to the server key "plugin_acme_a_b_".',
      pluginName: "acme",
      servers: ["a.b", "a_b"],
      keys: ["plugin_acme_a_b_", "plugin_acme_a_b_"],
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{");
  });

  test("ANAME-03: two servers whose keys differ only by - and _ refuse before any write", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-folded-same-plugin-");
    await writeSource(locations.mcpAdapterJsonPath, "{");

    // act
    const collision = await rejectionOf(preparePlugin(locations, cwd, "acme", ["a-b", "a_b"]));

    // assert
    assert.ok(collision instanceof McpServerKeyCollisionError);
    assert.deepStrictEqual(keyCollisionFields(collision), {
      name: "McpServerKeyCollisionError",
      message:
        'Refusing to stage MCP servers "a-b" and "a_b" of plugin "acme": their server keys "plugin_acme_a-b_" and "plugin_acme_a_b_" differ only by "-" and "_", which Pi treats as one tool namespace.',
      pluginName: "acme",
      servers: ["a-b", "a_b"],
      keys: ["plugin_acme_a-b_", "plugin_acme_a_b_"],
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{");
  });

  test("ANAME-03: another plugin's entry whose key folds onto ours refuses and names its key", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-folded-other-plugin-");
    const targetBytes =
      '{"mcpServers":{"plugin_my-tools_db_":{"url":"https://other.example/mcp","_piClaudeMarketplace":{"plugin":"my-tools","marketplace":"catalog"}}}}';
    await writeSource(locations.mcpAdapterJsonPath, targetBytes);

    // act
    const collision = await rejectionOf(preparePlugin(locations, cwd, "my_tools", ["db"]));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(foldedCollisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_my_tools_db_": ${locations.mcpAdapterJsonPath} already defines "plugin_my-tools_db_", which Pi treats as the same tool namespace because it does not tell "-" from "_".`,
      serverName: "plugin_my_tools_db_",
      owningPath: locations.mcpAdapterJsonPath,
      winningPath: locations.mcpAdapterJsonPath,
      definedAs: "plugin_my-tools_db_",
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), targetBytes);
  });

  test("ANAME-03: a marker-less full definition whose key folds onto ours refuses", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-folded-target-");
    const targetBytes = '{"mcpServers":{"plugin_acme_a-b_":{"command":"user"}}}';
    await writeSource(locations.mcpAdapterJsonPath, targetBytes);

    // act
    const collision = await rejectionOf(preparePlugin(locations, cwd, "acme", ["a_b"]));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(foldedCollisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_a_b_": ${locations.mcpAdapterJsonPath} already defines "plugin_acme_a-b_", which Pi treats as the same tool namespace because it does not tell "-" from "_".`,
      serverName: "plugin_acme_a_b_",
      owningPath: locations.mcpAdapterJsonPath,
      winningPath: locations.mcpAdapterJsonPath,
      definedAs: "plugin_acme_a-b_",
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), targetBytes);
  });

  test("ANAME-03: a full definition in ~/.agents/mcp.json whose key folds onto ours refuses and names that file", async (t) => {
    // arrange
    const { cwd, home } = await createHermeticEnvironment(t, "mcp-stage-folded-agents-");
    const locations = locationsFor("user", cwd);
    const agentsPath = path.join(home, ".agents", "mcp.json");
    const targetBytes = '{"mcpServers":{"mine":{"command":"mine"}}}';
    await writeSource(agentsPath, '{"mcpServers":{"plugin_acme_a-b_":{"command":"user"}}}');
    await writeSource(locations.mcpAdapterJsonPath, targetBytes);

    // act
    const collision = await rejectionOf(preparePlugin(locations, cwd, "acme", ["a_b"]));

    // assert
    assert.ok(collision instanceof McpServerCollisionError);
    assert.deepStrictEqual(foldedCollisionFields(collision), {
      name: "McpServerCollisionError",
      message: `Refusing to stage MCP server "plugin_acme_a_b_": ${agentsPath} already defines "plugin_acme_a-b_", which Pi treats as the same tool namespace because it does not tell "-" from "_".`,
      serverName: "plugin_acme_a_b_",
      owningPath: agentsPath,
      winningPath: locations.mcpAdapterJsonPath,
      definedAs: "plugin_acme_a-b_",
    });
    assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), targetBytes);
  });

  test("ANAME-03: the plugin's own entry under the other spelling is replaced, not refused", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-stage-folded-self-");
    await writeSource(
      locations.mcpAdapterJsonPath,
      '{"mcpServers":{"plugin_acme_a-b_":{"url":"https://old.example/mcp","_piClaudeMarketplace":{"plugin":"acme","marketplace":"catalog"}}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_a_b_": {
      "url": "https://x.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(await preparePlugin(locations, cwd, "acme", ["a_b"]));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
  });

  test("ANAME-03: a user key that differs from ours only in letter case does not refuse", async (t) => {
    // arrange
    const { cwd, home } = await createHermeticEnvironment(t, "mcp-stage-folded-case-");
    const locations = locationsFor("user", cwd);
    await writeSource(
      path.join(home, ".agents", "mcp.json"),
      '{"mcpServers":{"plugin_Acme_db_":{"command":"user"}}}',
    );
    const expectedBytes = `{
  "mcpServers": {
    "plugin_acme_db_": {
      "url": "https://x.example/mcp",
      "directTools": "search",
      "toolPrefix": "mcp",
      "_piClaudeMarketplace": {
        "plugin": "acme",
        "marketplace": "catalog"
      }
    }
  }
}
`;

    // act
    await commitPreparedMcp(await preparePlugin(locations, cwd, "acme", ["db"]));
    const storedBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");

    // assert
    assert.strictEqual(storedBytes, expectedBytes);
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
    "plugin_acme_local_": {
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
      "directTools": "search",
      "toolPrefix": "mcp",
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
      notices: [],
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
    assert.deepStrictEqual(commit, { stagedNames: [], recorded: [], warnings: [], notices: [] });
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
    "plugin_acme_owned_": {
      "command": "node",
      "env": {
        "CLAUDE_PLUGIN_ROOT": ${JSON.stringify(pluginRoot)},
        "CLAUDE_PLUGIN_DATA": ${JSON.stringify(pluginData)},
        "CLAUDE_PROJECT_DIR": ${JSON.stringify(cwd)}
      },
      "directTools": "search",
      "toolPrefix": "mcp",
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

  test("restores exact previous bytes that are not valid UTF-8", async (t) => {
    // arrange
    const { cwd, locations } = await createProjectScope(t, "mcp-rollback-raw-bytes-");
    const previousBytes = Buffer.concat([
      Buffer.from("{\n  // note: "),
      Buffer.from([0xff, 0xfe]),
      Buffer.from('\n  "mcpServers": {"foreign": {"command": "foreign"}}\n}\n'),
    ]);
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
    const restoredBytes = await readFile(locations.mcpAdapterJsonPath);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.deepStrictEqual(restoredBytes, previousBytes);
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
